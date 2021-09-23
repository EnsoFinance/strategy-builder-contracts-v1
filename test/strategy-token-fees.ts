import hre from 'hardhat'
import chai from 'chai'
import BigNumJs from 'bignumber.js'
const { ethers, waffle } = hre
const provider = waffle.provider
const { constants, getContractFactory, getSigners } = ethers
const { WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract, Event } from 'ethers'
import { prepareStrategy, Position, StrategyItem, StrategyState } from '../lib/encode'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployLoopRouter } from '../lib/deploy'
import { increaseTime } from '../lib/utils'

const NUM_TOKENS = 15
const YEAR = 31536000

chai.use(solidity)
describe('StrategyToken Fees', function () {
	let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		strategyFactory: Contract,
		controller: Contract,
		whitelist: Contract,
		router: Contract,
		oracle: Contract,
		adapter: Contract,
		strategy: Contract,
		wrapper: Contract,
		strategyItems: StrategyItem[],
		amount: BigNumber,
		total: BigNumber,
		lastTimestamp: BigNumJs

	async function estimateValue(account: string): Promise<BigNumber> {
		const [total, ] = await oracle.estimateStrategy(strategy.address);
		const totalSupply = await strategy.totalSupply()
		const balance = await strategy.balanceOf(account)
		return BigNumber.from(total).mul(balance).div(totalSupply)
	}

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[10], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[10], tokens)
		const platform = await deployPlatform(accounts[10], uniswapFactory, weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		adapter = await deployUniswapV2Adapter(accounts[10], uniswapFactory, weth)
		await whitelist.connect(accounts[10]).approve(adapter.address)
		router = await deployLoopRouter(accounts[10], controller)
		await whitelist.connect(accounts[10]).approve(router.address)
		const Strategy = await getContractFactory('Strategy')
		const strategyImplementation = await Strategy.connect(accounts[10]).deploy()
		await strategyImplementation.deployed()
		await strategyFactory.connect(accounts[10]).updateImplementation(strategyImplementation.address, '2')
	})

	it('Should deploy strategy', async function () {
		const positions: Position[] = [
			{ token: tokens[1].address, percentage: BigNumber.from(200) },
			{ token: tokens[2].address, percentage: BigNumber.from(200) },
			{ token: tokens[3].address, percentage: BigNumber.from(200) },
			{ token: tokens[4].address, percentage: BigNumber.from(400) },
		]
		strategyItems = prepareStrategy(positions, adapter.address)
		const strategyState: StrategyState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			slippage: BigNumber.from(995),
			performanceFee: BigNumber.from(100),
			social: true,
			set: false
		}

		amount = BigNumber.from('10000000000000000')
		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				'Test Strategy',
				'TEST',
				strategyItems,
				strategyState,
				router.address,
				'0x',
				{ value: amount }
			)
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const block = await provider.send('eth_getBlockByNumber', [BigNumber.from(receipt.blockNumber).toHexString(), true])
	  lastTimestamp = new BigNumJs(block.timestamp.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = Strategy.attach(strategyAddress)
		;[total] = await oracle.estimateStrategy(strategy.address)
		expect(BigNumber.from(await strategy.totalSupply()).eq(total)).to.equal(true)
		expect(BigNumber.from(await strategy.balanceOf(accounts[1].address)).eq(total)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()
	})

	it('Should progress blocks and collect streaming fee', async function () {
		const account1ValueBefore = new BigNumJs((await estimateValue(accounts[1].address)).toString())

		await increaseTime(YEAR)
		const tx = await strategy.connect(accounts[1]).withdrawStreamingFee()
		const receipt = await tx.wait()
		const block = await provider.send('eth_getBlockByNumber', [BigNumber.from(receipt.blockNumber).toHexString(), true])
	  const currentTimestamp = new BigNumJs(block.timestamp)

		const account1ValueAfter = new BigNumJs((await estimateValue(accounts[1].address)).toString())
		expect(account1ValueBefore.minus(account1ValueAfter).dividedBy(account1ValueBefore).multipliedBy(YEAR).dividedBy(currentTimestamp.minus(lastTimestamp)).dp(5).isEqualTo('0.01000')).to.equal(true)
		lastTimestamp = currentTimestamp
	})

	it('Should deposit', async function () {
		for (let i = 2; i < 10; i ++) {
			await controller.connect(accounts[i]).deposit(strategy.address, router.address, 0, '0x', { value: BigNumber.from('10000000000000000') })
		}
	})

	it('Should purchase a token, increasing strategy value', async function () {
		const valueBefore = await wrapper.getStrategyValue()
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value.mul(2) })
		await weth.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, tokens[1].address, accounts[2].address, accounts[2].address)
		//The following trade should increase the value of the token such that it doesn't need to be rebalanced
		await adapter
			.connect(accounts[2])
			.swap(
				value.div(4),
				0,
				weth.address,
				tokens[3].address,
				accounts[2].address,
				accounts[2].address
			)
		//await displayBalances(wrapper, strategyItems, weth)
		expect((await wrapper.getStrategyValue()).gt(valueBefore)).to.equal(true)
	})

	it('Should deposit', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[10].address)
		const tx = await controller.connect(accounts[10]).deposit(strategy.address, router.address, 0, '0x', { value: BigNumber.from('10000000000000000') })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[10].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should transfer tokens', async function () {
		const amount = BigNumber.from('5000000000000000')
		const balanceBefore = await strategy.balanceOf(accounts[10].address)
		console.log("Before: ", balanceBefore.toString())
		const tx = await strategy.connect(accounts[2]).transfer(accounts[11].address, amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[10].address)
		console.log("After: ", balanceBefore.toString())
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
		//expect(BigNumber.from(await strategy.balanceOf(accounts[9].address)).eq(amount)).to.equal(true)
	})
})
