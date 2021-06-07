const hre = require('hardhat')
const { ethers } = hre
const chai = require('chai')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
const BigNumJs = require('bignumber.js')
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { BigNumber, Contract, Event } from 'ethers'
import { StrategyBuilder, Position } from '../lib/encode'
import { TIMELOCK_CATEGORY } from '../lib/utils'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployLoopRouter } from '../lib/deploy'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH: Contract

chai.use(solidity)

describe('StrategyController', function () {
	let tokens: Contract[],
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		controllerAdmin: Contract,
		oracle: Contract,
		whitelist: Contract,
		adapter: Contract,
		failAdapter: Contract,
		failRouter: Contract,
		strategy: Contract,
		strategyTokens: string[],
		strategyPercentages: BigNumber[],
		strategyAdapters: string[],
		wrapper: Contract,
		newThreshold: BigNumber
	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[0], tokens)
		const p = await deployPlatform(accounts[0], uniswapFactory, WETH)
		;[strategyFactory, controller, oracle, whitelist, controllerAdmin] = [
			p.strategyFactory,
			p.controller,
			p.oracle,
			p.whitelist,
			p.controllerAdmin,
		]
		adapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, WETH)
		router = await deployLoopRouter(accounts[0], controller, adapter, WETH)
		await whitelist.connect(accounts[0]).approve(router.address)
	})

	it('Should get implementation', async function () {
		const implementation = await controllerAdmin.implementation()
		expect(implementation).to.not.equal(AddressZero)
	})

	it('Should fail to deploy strategy: threshold too high', async function () {
		await expect(
			strategyFactory
				.connect(accounts[1])
				.createStrategy(
					accounts[1].address,
					'Fail Strategy',
					'FAIL',
					[],
					[],
					false,
					0,
					10001,
					SLIPPAGE,
					TIMELOCK,
					router.address,
					'0x'
				)
		).to.be.revertedWith('Slippage/threshold high')
	})

	it('Should fail to deploy strategy: slippage too high', async function () {
		await expect(
			strategyFactory
				.connect(accounts[1])
				.createStrategy(
					accounts[1].address,
					'Fail Strategy',
					'FAIL',
					[],
					[],
					false,
					0,
					REBALANCE_THRESHOLD,
					1001,
					TIMELOCK,
					router.address,
					'0x'
				)
		).to.be.revertedWith('Slippage/threshold high')
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(200) },
			{ token: tokens[2].address, percentage: BigNumber.from(200) },
			{ token: tokens[3].address, percentage: BigNumber.from(50) },
			{ token: tokens[4].address, percentage: BigNumber.from(50) },
			{ token: tokens[5].address, percentage: BigNumber.from(50) },
			{ token: tokens[6].address, percentage: BigNumber.from(50) },
			{ token: tokens[7].address, percentage: BigNumber.from(50) },
			{ token: tokens[8].address, percentage: BigNumber.from(50) },
			{ token: tokens[9].address, percentage: BigNumber.from(50) },
			{ token: tokens[10].address, percentage: BigNumber.from(50) },
			{ token: tokens[11].address, percentage: BigNumber.from(50) },
			{ token: tokens[12].address, percentage: BigNumber.from(50) },
			{ token: tokens[13].address, percentage: BigNumber.from(50) },
			{ token: tokens[14].address, percentage: BigNumber.from(50) },
		] as Position[]
		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				strategyTokens,
				strategyPercentages,
				false,
				0,
				REBALANCE_THRESHOLD,
				SLIPPAGE,
				TIMELOCK,
				router.address,
				data,
				{ value: BigNumber.from('10000000000000000') }
			)
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to setup strategy: initialized', async function () {
		await expect(
			controller.setupStrategy(accounts[1].address, strategy.address, false, 0, 0, 0, 0, router.address, '0x')
		).to.be.revertedWith('Already setup')
	})

	it('Should fail to setup strategy: initialized', async function () {
		await expect(
			controller.setupStrategy(accounts[1].address, AddressZero, false, 0, 0, 0, 0, router.address, '0x')
		).to.be.revertedWith('Not factory')
	})

	it('Should fail to update value: restructure is invalid option', async function () {
		await expect(
			controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.RESTRUCTURE, 0)
		).to.be.revertedWith('')
	})

	it('Should fail to update value: option out of bounds', async function () {
		await expect(controller.connect(accounts[1]).updateValue(strategy.address, 5, 0)).to.be.revertedWith('')
	})

	it('Should fail to update threshold: not manager', async function () {
		await expect(
			controller.connect(accounts[0]).updateValue(strategy.address, TIMELOCK_CATEGORY.THRESHOLD, 1)
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to update threshold: value too large', async function () {
		await expect(
			controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.THRESHOLD, 1001)
		).to.be.revertedWith('Value too high')
	})

	it('Should update threshold', async function () {
		newThreshold = BigNumber.from(15)
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.THRESHOLD, newThreshold)
	})

	it('Should fail to finalize restructure: timelock not set for restructure', async function () {
		await expect(
			controller.connect(accounts[1]).finalizeStructure(strategy.address, router.address, [], [])
		).to.be.revertedWith('Wrong category')
	})

	it('Should finalize value', async function () {
		expect(BigNumber.from(await controller.rebalanceThreshold(strategy.address)).eq(REBALANCE_THRESHOLD)).to.equal(
			true
		)
		await controller.finalizeValue(strategy.address)
		expect(BigNumber.from(await controller.rebalanceThreshold(strategy.address)).eq(newThreshold)).to.equal(true)
	})

	it('Should fail to update slippage: not manager', async function () {
		await expect(
			controller.connect(accounts[0]).updateValue(strategy.address, TIMELOCK_CATEGORY.SLIPPAGE, 1)
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to update slippage: value too large', async function () {
		await expect(
			controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.SLIPPAGE, 1001)
		).to.be.revertedWith('Value too high')
	})

	it('Should update slippage', async function () {
		const slippage = 990
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.SLIPPAGE, slippage)
		await controller.finalizeValue(strategy.address)
		expect(BigNumber.from(await controller.slippage(strategy.address)).eq(slippage)).to.equal(true)
	})

	it('Should fail to update timelock: not manager', async function () {
		await expect(
			controller.connect(accounts[0]).updateValue(strategy.address, TIMELOCK_CATEGORY.TIMELOCK, 1)
		).to.be.revertedWith('Not manager')
	})

	it('Should update timelock', async function () {
		const timelock = 0
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.TIMELOCK, timelock)
		await controller.finalizeValue(strategy.address)
		expect(BigNumber.from(await controller.timelock(strategy.address)).eq(timelock)).to.equal(true)
	})

	it('Should fail to rebalance, already balanced', async function () {
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
		).to.be.revertedWith('Balanced')
	})

	it('Should purchase a token, requiring a rebalance', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(50)
		await WETH.connect(accounts[2]).deposit({ value: value.mul(2) })
		await WETH.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, tokens[1].address, accounts[2].address, accounts[2].address, '0x', '0x')
		//The following trade should increase the value of the token such that it doesn't need to be rebalanced
		await adapter
			.connect(accounts[2])
			.swap(
				value.div(4),
				0,
				WETH.address,
				tokens[3].address,
				accounts[2].address,
				accounts[2].address,
				'0x',
				'0x'
			)
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should fail to rebalance, router not approved', async function () {
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		await expect(controller.connect(accounts[1]).rebalance(strategy.address, AddressZero, data)).to.be.revertedWith(
			'Router not approved'
		)
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

	it('Should fail to rebalance, only manager may rebalance', async function () {
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		await expect(
			controller.connect(accounts[2]).rebalance(strategy.address, router.address, data)
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to deposit: not manager', async function () {
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		await expect(
			controller
				.connect(accounts[0])
				.deposit(strategy.address, router.address, data, { value: BigNumber.from('10000000000000000') })
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to deposit: no funds deposited', async function () {
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, router.address, data)
		).to.be.revertedWith('Swap failed')
	})

	it('Should fail to deposit: incorrect adapters', async function () {
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, []])
		await expect(
			controller
				.connect(accounts[1])
				.deposit(strategy.address, router.address, data, { value: BigNumber.from('10000000000000000') })
		).to.be.revertedWith('Routers/items mismatch')
	})

	it('Should deposit more', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[1].address)
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, router.address, data, { value: BigNumber.from('10000000000000000') })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[1].address)
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should fail to withdraw: no strategy tokens', async function () {
		await expect(strategy.connect(accounts[0]).withdraw(1)).to.be.revertedWith('ERC20: Amount exceeds balance')
	})

	it('Should fail to withdraw: no amount passed', async function () {
		await expect(strategy.connect(accounts[1]).withdraw(0)).to.be.revertedWith('0 amount')
	})

	it('Should withdraw', async function () {
		const amount = BigNumber.from('10000000000000')
		const supplyBefore = BigNumJs((await strategy.totalSupply()).toString())
		const tokenBalanceBefore = BigNumJs((await tokens[1].balanceOf(strategy.address)).toString())
		const tx = await strategy.connect(accounts[1]).withdraw(amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const supplyAfter = BigNumJs((await strategy.totalSupply()).toString())
		const tokenBalanceAfter = BigNumJs((await tokens[1].balanceOf(strategy.address)).toString())
		expect(supplyBefore.minus(amount.toString()).eq(supplyAfter)).to.equal(true)
		expect(
			supplyBefore
				.div(supplyAfter)
				.decimalPlaces(10)
				.isEqualTo(tokenBalanceBefore.div(tokenBalanceAfter).decimalPlaces(10))
		).to.equal(true)
		expect(tokenBalanceBefore.gt(tokenBalanceAfter)).to.equal(true)
	})

	it('Should fail to restructure: no items', async function () {
		await expect(controller.connect(accounts[1]).restructure(strategy.address, [], [])).to.be.revertedWith(
			'Cannot set empty structure'
		)
	})

	it('Should fail to restructure: wrong array length', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(500) },
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(0) },
		]
		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]
		await expect(
			controller.connect(accounts[1]).restructure(strategy.address, strategyTokens, [500, 500])
		).to.be.revertedWith('Invalid input lengths')
	})

	it('Should fail to restructure: wrong percentages', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(300) },
			{ token: tokens[1].address, percentage: BigNumber.from(300) },
			{ token: tokens[2].address, percentage: BigNumber.from(300) },
		] as Position[]
		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]
		await expect(
			controller.connect(accounts[1]).restructure(strategy.address, strategyTokens, strategyPercentages)
		).to.be.revertedWith('Total percentage wrong')
	})

	it('Should fail to restructure: not manager', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(300) },
			{ token: tokens[1].address, percentage: BigNumber.from(300) },
			{ token: tokens[2].address, percentage: BigNumber.from(400) },
		] as Position[]
		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]
		await expect(
			controller.connect(accounts[2]).restructure(strategy.address, strategyTokens, strategyPercentages)
		).to.be.revertedWith('Not manager')
	})

	it('Should restructure', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(300) },
			{ token: tokens[1].address, percentage: BigNumber.from(300) },
			{ token: tokens[2].address, percentage: BigNumber.from(400) },
		] as Position[]
		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]
		await controller.connect(accounts[1]).restructure(strategy.address, strategyTokens, strategyPercentages)
	})

	it('Should fail to finalize value: wrong category', async function () {
		await expect(controller.finalizeValue(strategy.address)).to.be.revertedWith('Wrong category')
	})

	it('Should fail to finalize structure: sell adapters mismatch', async function () {
		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, router.address, strategyAdapters, strategyAdapters)
		).to.be.revertedWith('Sell adapters length')
	})

	it('Should fail to finalize structure: buy adapters mismatch', async function () {
		const currentTokens = await strategy.items()
		const sellAdapters = currentTokens.map(() => adapter.address)

		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, router.address, sellAdapters, sellAdapters)
		).to.be.revertedWith('Buy adapters length')
	})

	it('Should fail to finalize structure: value slipped', async function () {
		const MaliciousAdapter = await getContractFactory('MaliciousAdapter')
		const maliciousAdapter = await MaliciousAdapter.connect(accounts[1]).deploy(WETH.address)
		await maliciousAdapter.deployed()

		const currentTokens = await strategy.items()
		const sellAdapters = currentTokens.map(() => adapter.address)
		const maliciousAdapters = strategyTokens.map(() => maliciousAdapter.address)

		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, router.address, sellAdapters, maliciousAdapters)
		).to.be.revertedWith('Value slipped')
	})

	it('Should finalize structure', async function () {
		const currentTokens = await strategy.items()
		const sellAdapters = currentTokens.map(() => adapter.address)

		await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, router.address, sellAdapters, strategyAdapters)
		//await displayBalances(wrapper, strategyTokens, WETH)
	})

	it('Should have no token 3', async function () {
		const [total, estimates] = await oracle.estimateTotal(strategy.address, [tokens[3].address])
		expect(total.eq(0)).to.equal(true)
		expect(estimates[0].eq(0)).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance', async function () {
		if (strategyTokens[0] === WETH.address) {
			const value = await tokens[1].balanceOf(accounts[2].address)
			await tokens[1].connect(accounts[2]).approve(adapter.address, value)
			await adapter
				.connect(accounts[2])
				.swap(value, 0, tokens[1].address, WETH.address, accounts[2].address, accounts[2].address, '0x', '0x')
		} else {
			const value = WeiPerEther.mul(100)
			await WETH.connect(accounts[2]).deposit({ value: value })
			await WETH.connect(accounts[2]).approve(adapter.address, value)
			await adapter
				.connect(accounts[2])
				.swap(value, 0, WETH.address, strategyTokens[0], accounts[2].address, accounts[2].address, '0x', '0x')
		}

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

	it('Should fail to open strategy: not manager', async function () {
		await expect(controller.connect(accounts[0]).openStrategy(strategy.address, 0)).to.be.revertedWith(
			'Not manager'
		)
	})

	it('Should fail to open strategy: fee too high', async function () {
		await expect(controller.connect(accounts[1]).openStrategy(strategy.address, 1000)).to.be.revertedWith(
			'Fee too high'
		)
	})

	it('Should open strategy', async function () {
		await controller.connect(accounts[1]).openStrategy(strategy.address, 10)
		expect(await controller.social(strategy.address)).to.equal(true)
	})

	it('Should call update on oracle', async function () {
		const tx = await oracle.update(tokens[1].address)
		const receipt = await tx.wait()
		const newPriceEvent = receipt.events.find((ev: Event) => ev.event === 'NewPrice').args
		expect(newPriceEvent.token.toLowerCase()).to.equal(tokens[1].address.toLowerCase())
		expect(newPriceEvent.price.gt(0)).to.equal(true)
	})

	it('Should return 0 when passing 0 to consult', async function () {
		const value = await oracle.consult(0, tokens[1].address)
		expect(value.eq(0)).to.equal(true)
	})

	it('Should return value when consult oracle about weth price', async function () {
		const value = await oracle.consult(1, tokens[0].address)
		expect(value.eq(1)).to.equal(true)
	})

	it('Should return 0 when estimating total of ETH in strategy', async function () {
		const [total, estimates] = await oracle.estimateTotal(strategy.address, [AddressZero])
		expect(total.eq(0)).to.equal(true)
		expect(estimates[0].eq(0)).to.equal(true)
	})

	it('Should deploy fail adapter+router', async function () {
		const FailAdapter = await getContractFactory('FailAdapter')
		failAdapter = await FailAdapter.deploy(WETH.address)
		await failAdapter.deployed()
		failRouter = await deployLoopRouter(accounts[0], controller, failAdapter, WETH)
		await whitelist.connect(accounts[0]).approve(failRouter.address)
	})

	it('Should fail to rebalance: fail adapter (_sellTokens)', async function () {
		const value = WeiPerEther.mul(100)
		await WETH.connect(accounts[2]).deposit({ value: value })
		await WETH.connect(accounts[2]).approve(adapter.address, value)
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, tokens[1].address, accounts[2].address, accounts[2].address, '0x', '0x')

		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])

		await failAdapter.setSellFail(true)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, failRouter.address, data)
		).to.be.revertedWith('Swap failed')
		await failAdapter.setSellFail(false)
	})

	it('Should fail to rebalance: fail adapter (_buyTokens)', async function () {
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])

		await failAdapter.setBuyFail(true)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, failRouter.address, data)
		).to.be.revertedWith('Swap failed')
		await failAdapter.setBuyFail(true)
	})

	it('Should fail to deposit: fail adapter', async function () {
		const failAdapters = strategyTokens.map(() => failAdapter.address)
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, failAdapters])
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, failRouter.address, data, { value: WeiPerEther })
		).to.be.revertedWith('Swap failed')
	})

	it('Should restructure', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) },
		] as Position[]

		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]
		await controller.connect(accounts[1]).restructure(strategy.address, strategyTokens, strategyPercentages)
	})

	it('Should fail to finalize: fail sell adapter', async function () {
		const currentTokens = await strategy.items()
		const failAdapters = currentTokens.map(() => failAdapter.address)

		await failAdapter.setSellFail(true)
		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, router.address, failAdapters, strategyAdapters)
		).to.be.revertedWith('Swap failed')
		await failAdapter.setSellFail(false)
	})

	it('Should fail to finalize: fail sell adapter', async function () {
		const currentTokens = await strategy.items()
		const sellAdapters = currentTokens.map(() => adapter.address)
		const failAdapters = strategyTokens.map(() => failAdapter.address)

		await failAdapter.setSellFail(true)
		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, router.address, sellAdapters, failAdapters)
		).to.be.revertedWith('Swap failed')
		await failAdapter.setSellFail(false)
	})

	it('Should finalize structure', async function () {
		const currentTokens = await strategy.items()
		const sellAdapters = currentTokens.map(() => adapter.address)

		await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, router.address, sellAdapters, strategyAdapters)
		//await displayBalances(wrapper, strategyTokens, WETH)
	})

	it('Should fail to rebalance: fail adapter (_buyTokens)', async function () {
		const value = tokens[1].balanceOf(accounts[2].address)
		await tokens[1].connect(accounts[2]).approve(adapter.address, value)
		await adapter
			.connect(accounts[2])
			.swap(value, 0, tokens[1].address, WETH.address, accounts[2].address, accounts[2].address, '0x', '0x')

		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])

		await failAdapter.setBuyFail(true)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, failRouter.address, data)
		).to.be.revertedWith('Swap failed')
		await failAdapter.setBuyFail(true)
	})
})
