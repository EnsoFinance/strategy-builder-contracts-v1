import hre from 'hardhat'
import chai from 'chai'
import BigNumJs from 'bignumber.js'
const { ethers, waffle } = hre
const provider = waffle.provider
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther /*, MaxUint256*/ } = constants
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract, Event } from 'ethers'
import { prepareStrategy, Position, StrategyItem, InitialState } from '../lib/encode'
import {
	Platform,
	deployTokens,
	deployUniswapV2,
	deployUniswapV2Adapter,
	deployPlatform,
	deployLoopRouter,
} from '../lib/deploy'
import { increaseTime } from '../lib/utils'
import { initializeTestLogging, logTestComplete } from '../lib/convincer'
import { DEFAULT_DEPOSIT_SLIPPAGE } from '../lib/constants'

const NUM_TOKENS = 15
const YEAR = 331556952

chai.use(solidity)
describe('StrategyToken Fees', function () {
	let proofCounter: number
	let platform: Platform,
		tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		owner: SignerWithAddress,
		manager: SignerWithAddress,
		uniswapFactory: Contract,
		strategyFactory: Contract,
		controller: Contract,
		whitelist: Contract,
		router: Contract,
		oracle: Contract,
		controllerLibrary: Contract,
		adapter: Contract,
		strategy: Contract,
		wrapper: Contract,
		strategyItems: StrategyItem[],
		amount: BigNumber,
		total: BigNumber,
		lastTimestamp: BigNumJs

	async function estimateValue(account: string): Promise<BigNumber> {
		const [total] = await oracle.estimateStrategy(strategy.address)
		const totalSupply = await strategy.totalSupply()
		const balance = await strategy.balanceOf(account)
		return BigNumber.from(total).mul(balance).div(totalSupply)
	}

	before('Setup Uniswap + Factory', async function () {
    proofCounter = initializeTestLogging(this, __dirname)
		accounts = await getSigners()
		owner = accounts[10]
		manager = accounts[1]
		tokens = await deployTokens(owner, NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(owner, tokens)
		platform = await deployPlatform(owner, uniswapFactory, new Contract(AddressZero, [], owner), weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		controllerLibrary = platform.controllerLibrary
		adapter = await deployUniswapV2Adapter(owner, uniswapFactory, weth)
		await whitelist.connect(owner).approve(adapter.address)
		router = await deployLoopRouter(owner, controller, platform.strategyLibrary)
		await whitelist.connect(owner).approve(router.address)
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
			managementFee: BigNumber.from(1),
			social: true,
			set: false,
		}

		amount = BigNumber.from('10000000000000000')
		let tx = await strategyFactory
			.connect(manager)
			.createStrategy('Test Strategy', 'TEST', strategyItems, strategyState, router.address, '0x', {
				value: amount,
			})
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const block = await provider.send('eth_getBlockByNumber', [
			BigNumber.from(receipt.blockNumber).toHexString(),
			true,
		])
		lastTimestamp = new BigNumJs(block.timestamp.toString())
		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()
		strategy = Strategy.attach(strategyAddress)
		;[total] = await oracle.estimateStrategy(strategy.address)
		expect(BigNumber.from(await strategy.totalSupply()).eq(total)).to.equal(true)
		expect(BigNumber.from(await strategy.balanceOf(manager.address)).eq(total)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: platform.strategyLibrary.address,
				ControllerLibrary: controllerLibrary.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should progress blocks and collect streaming fee', async function () {
		const account1ValueBefore = new BigNumJs((await estimateValue(manager.address)).toString())

		await increaseTime(YEAR)

		const tx = await strategy.connect(manager).withdrawStreamingFee()
		const receipt = await tx.wait()
		const block = await provider.send('eth_getBlockByNumber', [
			BigNumber.from(receipt.blockNumber).toHexString(),
			true,
		])
		const currentTimestamp = new BigNumJs(block.timestamp)

		const account1ValueAfter = new BigNumJs((await estimateValue(manager.address)).toString())

		const actualRatio = account1ValueAfter.dividedBy(account1ValueBefore)
		const expectedRatio = new BigNumJs(
			Math.pow(0.999, currentTimestamp.minus(lastTimestamp).dividedBy(YEAR).toNumber())
		)
		console.log('Actual ratio: ', actualRatio.dp(5).toString())
		console.log('Expeced ratio: ', expectedRatio.dp(5).toString())

		expect(actualRatio.dp(5).isEqualTo(expectedRatio.dp(5))).to.equal(true)
		lastTimestamp = currentTimestamp
	})

	it('Should deposit', async function () {
		for (let i = 2; i < 10; i++) {
			await controller
				.connect(accounts[i])
				.deposit(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', {
					value: BigNumber.from('10000000000000000'),
				})
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
			.swap(value.div(4), 0, weth.address, tokens[3].address, accounts[2].address, accounts[2].address)
		expect((await wrapper.getStrategyValue()).gt(valueBefore)).to.equal(true)
	})

	it('Should deposit', async function () {
		const someUser = accounts[3]
		const balanceBefore = await strategy.balanceOf(someUser.address)
		const tx = await controller
			.connect(someUser)
			.deposit(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', {
				value: BigNumber.from('10000000000000000'),
			})
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(someUser.address)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should transfer tokens to a non-holder', async function () {
		const amount = BigNumber.from('5000000000000000')
		const userA = accounts[2]
		const userB = accounts[11]

		const managerBalanceBefore = await strategy.balanceOf(manager.address)
		const ownerBalanceBefore = await strategy.balanceOf(owner.address)

		expect((await strategy.balanceOf(userB.address)).eq(0)).to.equal(true)
		const tx = await strategy.connect(userA).transfer(userB.address, amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())

		const managerBalanceAfter = await strategy.balanceOf(manager.address)
		const ownerBalanceAfter = await strategy.balanceOf(owner.address)

		const ownerMint = ownerBalanceAfter.sub(ownerBalanceBefore)
		const managerMint = managerBalanceAfter.sub(managerBalanceBefore)
		expect(ownerMint.eq(0)).to.equal(true)
		expect(managerMint.eq(0)).to.equal(true)
	})

	it('Should transfer tokens', async function () {
		const amount = BigNumber.from('5000000000000000')
		const userA = accounts[3]
		const userB = accounts[4]

		const managerBalanceBefore = await strategy.balanceOf(manager.address)
		const ownerBalanceBefore = await strategy.balanceOf(owner.address)

		const tx = await strategy.connect(userA).transfer(userB.address, amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())

		const managerBalanceAfter = await strategy.balanceOf(manager.address)
		const ownerBalanceAfter = await strategy.balanceOf(owner.address)

		const ownerMint = ownerBalanceAfter.sub(ownerBalanceBefore)
		const managerMint = managerBalanceAfter.sub(managerBalanceBefore)
		expect(ownerMint.eq(0)).to.equal(true)
		expect(managerMint.eq(0)).to.equal(true)
	})

	it('Should transfer tokens to manager', async function () {
		const amount = BigNumber.from('2500000000000000')
		const user = accounts[3]

		const managerBalanceBefore = await strategy.balanceOf(manager.address)
		const ownerBalanceBefore = await strategy.balanceOf(owner.address)

		const tx = await strategy.connect(user).transfer(manager.address, amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())

		const managerBalanceAfter = await strategy.balanceOf(manager.address)
		const ownerBalanceAfter = await strategy.balanceOf(owner.address)

		const ownerMint = ownerBalanceAfter.sub(ownerBalanceBefore)
		const managerMint = managerBalanceAfter.sub(managerBalanceBefore)
		expect(ownerMint.gt(0)).to.equal(true)
		expect(managerMint.gt(amount)).to.equal(true)
	})

	it('Should withdraw tokens (including pool tokens)', async function () {
		const user = accounts[4]

		const ownerBalance = await strategy.balanceOf(owner.address)
		const amount = ownerBalance.mul(10)

		const userBalanceBefore = await weth.balanceOf(user.address)
		const ownerBalanceBefore = await weth.balanceOf(owner.address)

		const tx = await controller.connect(user).withdrawWETH(strategy.address, router.address, amount, '0', '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())

		const userBalanceAfter = await weth.balanceOf(user.address)
		const ownerBalanceAfter = await weth.balanceOf(owner.address)

		const ownerWithdraw = ownerBalanceAfter.sub(ownerBalanceBefore)
		const userWithdraw = userBalanceAfter.sub(userBalanceBefore)
		expect(ownerWithdraw.gt(0)).to.equal(true)
		expect(userWithdraw.gt(0)).to.equal(true)
	})
})
