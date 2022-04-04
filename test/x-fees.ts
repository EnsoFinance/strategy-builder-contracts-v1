import hre from 'hardhat'
import chai from 'chai'
import BigNumJs from 'bignumber.js'
const { ethers, waffle } = hre
const provider = waffle.provider
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther, MaxUint256 } = constants
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract, Event } from 'ethers'
import { prepareStrategy, Position, StrategyItem, InitialState } from '../lib/encode'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployLoopRouter } from '../lib/deploy'
import { increaseTime } from '../lib/utils'
import {  DEFAULT_DEPOSIT_SLIPPAGE } from '../lib/constants'

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
		library: Contract,
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
		const platform = await deployPlatform(accounts[10], uniswapFactory, new Contract(AddressZero, [], accounts[10]), weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		library = platform.library
		adapter = await deployUniswapV2Adapter(accounts[10], uniswapFactory, weth)
		await whitelist.connect(accounts[10]).approve(adapter.address)
		router = await deployLoopRouter(accounts[10], controller, library)
		await whitelist.connect(accounts[10]).approve(router.address)
	})

	it('Should deploy strategy', async function () {
		const positions: Position[] = [
			{ token: tokens[1].address, percentage: BigNumber.from(200) },
			{ token: tokens[2].address, percentage: BigNumber.from(200) },
			{ token: tokens[3].address, percentage: BigNumber.from(200) },
			{ token: tokens[4].address, percentage: BigNumber.from(400) },
		]
		strategyItems = prepareStrategy(positions, adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(995),
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

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
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

		const actualRatio = account1ValueAfter.dividedBy(account1ValueBefore)
		const expectedRatio = new BigNumJs(Math.pow(0.999, currentTimestamp.minus(lastTimestamp).dividedBy(YEAR).toNumber()))

		expect(actualRatio.dp(5).isEqualTo(expectedRatio.dp(5))).to.equal(true)
		lastTimestamp = currentTimestamp
	})

	it('Should deposit', async function () {
		for (let i = 2; i < 10; i ++) {
			await controller.connect(accounts[i]).deposit(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', { value: BigNumber.from('10000000000000000') })
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
		expect((await strategy.getPerformanceFeeOwed(accounts[3].address)).gt(0)).to.equal(false)
		await strategy.connect(accounts[1])['updateTokenValue()']()
		expect((await strategy.getPerformanceFeeOwed(accounts[3].address)).gt(0)).to.equal(true)
	})

	it('Should deposit', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[10].address)
		const tx = await controller.connect(accounts[1]).deposit(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', { value: BigNumber.from('10000000000000000') })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[10].address)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should transfer tokens to a non-holder', async function () {
		const amount = BigNumber.from('5000000000000000')
		const paidTokenValueBefore = await strategy.getPaidTokenValue(accounts[2].address)
		expect((await strategy.balanceOf(accounts[11].address)).eq(0)).to.equal(true)
		expect((await strategy.getPaidTokenValue(accounts[11].address)).eq(0)).to.equal(true)
		const tx = await strategy.connect(accounts[2]).transfer(accounts[11].address, amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const paidTokenValueAfter = await strategy.getPaidTokenValue(accounts[2].address)
		const paidTokenValueNewUser = await strategy.getPaidTokenValue(accounts[11].address)
		expect(paidTokenValueAfter.eq(paidTokenValueBefore)).to.equal(true)
		expect(paidTokenValueAfter.eq(paidTokenValueNewUser)).to.equal(true)
	})

	it('Should transfer tokens', async function () {
		const amount = BigNumber.from('5000000000000000')
		const userA = accounts[3]
		const userB = accounts[4]

		const managerBalanceBefore = await strategy.balanceOf(accounts[1].address)
		const ownerBalanceBefore = await strategy.balanceOf(accounts[10].address)
		const balanceABefore = await strategy.balanceOf(userA.address)
		const balanceBBefore = await strategy.balanceOf(userB.address)
		expect(balanceBBefore.gt(0)).to.equal(true)

		const paidTokenValueABefore = new BigNumJs((await strategy.getPaidTokenValue(userA.address)).toString())
		const paidTokenValueBBefore = new BigNumJs((await strategy.getPaidTokenValue(userB.address)).toString())

		const tx = await strategy.connect(userA).transfer(accounts[4].address, amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())

		const managerBalanceAfter = await strategy.balanceOf(accounts[1].address)
		const ownerBalanceAfter = await strategy.balanceOf(accounts[10].address)
		expect(ownerBalanceAfter.gt(ownerBalanceBefore)).to.equal(true)

		const lastTokenValue = await strategy.getLastTokenValue()
		const paidTokenValueAAfter = new BigNumJs((await strategy.getPaidTokenValue(userA.address)).toString())
		expect(paidTokenValueAAfter.toString()).to.be.equal(lastTokenValue.toString())
		const paidTokenValueBAfter = new BigNumJs((await strategy.getPaidTokenValue(userB.address)).toString())
		expect(paidTokenValueBAfter.toString()).to.be.equal(lastTokenValue.toString())

		const ownerMint = ownerBalanceAfter.sub(ownerBalanceBefore)
		const managerMint = managerBalanceAfter.sub(managerBalanceBefore)
		const totalMint = new BigNumJs(ownerMint.add(managerMint).toString())

		const balanceEquivalentA = paidTokenValueAAfter.minus(paidTokenValueABefore).multipliedBy(balanceABefore.toString()).dividedBy(paidTokenValueAAfter)
		const balanceEquivalentB = paidTokenValueBAfter.minus(paidTokenValueBBefore).multipliedBy(balanceBBefore.toString()).dividedBy(paidTokenValueBAfter)
		const percentage = totalMint.dividedBy(balanceEquivalentA.plus(balanceEquivalentB))
		expect(percentage.dp(5).toString()).to.equal('0.1') //10%
	})

	it('Should withdraw pool rewards', async function () {
		expect(await strategyFactory.pool()).to.be.equal(accounts[10].address)
		const balanceBefore = await strategy.balanceOf(accounts[10].address)
		const tokens1Before = await tokens[1].balanceOf(accounts[10].address)
		await strategy.connect(accounts[10]).withdrawAll(balanceBefore)
		const tokens1After = await tokens[1].balanceOf(accounts[10].address)
		expect(tokens1After).to.be.gt(tokens1Before)
	})

	it('Should update manager', async function() {
		expect(await strategy.getPaidTokenValue(accounts[19].address)).to.equal(BigNumber.from(0))
		await strategy.connect(accounts[1]).updateManager(accounts[19].address)
		expect(await strategy.getPaidTokenValue(accounts[19].address)).to.equal(MaxUint256)
	})
})
