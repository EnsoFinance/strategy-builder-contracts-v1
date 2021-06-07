import { expect } from 'chai'
import { solidity } from 'ethereum-waffle'
const chai = require('chai')
chai.use(solidity)
const hre = require('hardhat')
const { ethers } = hre
import { StrategyBuilder } from '../lib/encode'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployLoopRouter } from '../lib/deploy'
import { increaseTime, TIMELOCK_CATEGORY } from '../lib/utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, BigNumber, Event } from 'ethers'
const { constants, getContractFactory, getSigners } = ethers
const { WeiPerEther } = constants

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH: Contract

describe('StrategyController - Social', function () {
	let tokens: Contract[],
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		adapter: Contract,
		strategy: Contract,
		strategyTokens: string[],
		strategyPercentages: BigNumber[],
		strategyAdapters: string[],
		wrapper: Contract

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[0], tokens)

		const p = await deployPlatform(accounts[0], uniswapFactory, WETH)
		;[strategyFactory, controller, oracle, whitelist] = [p.strategyFactory, p.controller, p.oracle, p.whitelist]
		adapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, WETH)
		router = await deployLoopRouter(accounts[0], controller, adapter, WETH)
		await whitelist.connect(accounts[0]).approve(router.address)
	})

	it('Should deploy strategy', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(400) },
			{ token: tokens[1].address, percentage: BigNumber.from(200) },
			{ token: tokens[2].address, percentage: BigNumber.from(200) },
			{ token: tokens[3].address, percentage: BigNumber.from(200) },
		]

		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters];
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy',
			'TEST',
			strategyTokens,
			strategyPercentages,
			true,
			50, // 5% fee
			REBALANCE_THRESHOLD,
			SLIPPAGE,
			TIMELOCK,
			router.address,
			data,
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyTokens, WETH)
		//expect(await strategy.getStrategyValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to withdraw performance fee: no earnings', async function () {
		await expect(controller.connect(accounts[1]).withdrawPerformanceFee(strategy.address)).to.be.revertedWith(
			'No earnings'
		)
	})

	it('Should purchase tokens, requiring a rebalance', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(50)
		await WETH.connect(accounts[2]).deposit({ value: value.mul(2) })
		await WETH.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, tokens[1].address, accounts[2].address, accounts[2].address, [], [])
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, tokens[2].address, accounts[2].address, accounts[2].address, [], [])
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deposit more', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[2].address)
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		const tx = await controller
			.connect(accounts[2])
			.deposit(strategy.address, router.address, data, { value: ethers.BigNumber.from('10000000000000000') })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[2].address)
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should fail to withdraw performance fee: not manager', async function () {
		await expect(controller.connect(accounts[2]).withdrawPerformanceFee(strategy.address)).to.be.revertedWith(
			'Not manager'
		)
	})

	it('Should withdraw performance fee', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[1].address)
		await controller.connect(accounts[1]).withdrawPerformanceFee(strategy.address)
		const balanceAfter = await strategy.balanceOf(accounts[1].address)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should withdraw', async function () {
		const amount = BigNumber.from('10000000000000')
		const supplyBefore = BigNumber.from((await strategy.totalSupply()).toString())
		const tokenBalanceBefore = BigNumber.from((await tokens[1].balanceOf(strategy.address)).toString())
		const tx = await strategy.connect(accounts[1]).withdraw(amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const supplyAfter = BigNumber.from((await strategy.totalSupply()).toString())
		const tokenBalanceAfter = BigNumber.from((await tokens[1].balanceOf(strategy.address)).toString())
		expect(supplyBefore.sub(amount.toString()).eq(supplyAfter)).to.equal(true)
		// expect(
		// 	supplyBefore
		// 		.div(supplyAfter)
		// 		.decimalPlaces(10)
		// 		.isEqualTo(tokenBalanceBefore.dividedBy(tokenBalanceAfter).decimalPlaces(10))
		// ).to.equal(true)
		expect(tokenBalanceBefore.gt(tokenBalanceAfter)).to.equal(true)
	})

	it('Should restructure', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(300) },
			{ token: tokens[1].address, percentage: BigNumber.from(300) },
			{ token: tokens[2].address, percentage: BigNumber.from(400) },
		]

		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]
		await controller.connect(accounts[1]).restructure(strategy.address, strategyTokens, strategyPercentages)
	})

	it('Should fail to restructure: time lock active', async function () {
		await expect(controller.connect(accounts[1]).restructure(strategy.address, [], [])).to.be.revertedWith(
			'Timelock active'
		)
	})

	it('Should fail to update value: time lock active', async function () {
		await expect(
			controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.TIMELOCK, 0)
		).to.be.revertedWith('Timelock active')
	})

	it('Should fail to finalize structure: time lock not passed', async function () {
		const currentTokens = await strategy.items()
		const sellAdapters = currentTokens.map(() => adapter.address)

		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, router.address, sellAdapters, strategyAdapters)
		).to.be.revertedWith('Timelock active')
	})

	it('Should finalize structure', async function () {
		await increaseTime(TIMELOCK)
		const currentTokens = await strategy.items()
		const sellAdapters = currentTokens.map(() => adapter.address)

		await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, router.address, sellAdapters, strategyAdapters)
		//await displayBalances(wrapper, strategyTokens, WETH)
	})

	it('Should purchase a token, requiring a rebalance', async function () {
		const value = WeiPerEther.mul(100)
		await WETH.connect(accounts[2]).deposit({ value: value })
		await WETH.connect(accounts[2]).approve(adapter.address, value)
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, tokens[2].address, accounts[2].address, accounts[2].address, [], [])
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should update timelock + fail to finalize: timelock active', async function () {
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.TIMELOCK, 0)
		await expect(controller.connect(accounts[1]).finalizeValue(strategy.address)).to.be.revertedWith(
			'Timelock active'
		)
	})
})
