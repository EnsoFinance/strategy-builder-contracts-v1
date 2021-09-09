import chai from 'chai'
const { expect } = chai
import hre from 'hardhat'
const { ethers } = hre
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
import BigNumJs from 'bignumber.js'
import { solidity } from 'ethereum-waffle'

import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { prepareStrategy, Position, StrategyItem, StrategyState } from '../lib/encode'
import { TIMELOCK_CATEGORY } from '../lib/utils'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployLoopRouter, Platform } from '../lib/deploy'
//import { displayBalances } from '../lib/logging'


const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = BigNumber.from(10) // 10/1000 = 1%
const SLIPPAGE = BigNumber.from(995) // 995/1000 = 99.5%
const TIMELOCK = BigNumber.from(60) // 1 minute

chai.use(solidity)

describe('controller', function () {
	let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		platform: Platform,
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		adapter: Contract,
		failAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		newThreshold: BigNumber

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[0], tokens)
		platform = await deployPlatform(accounts[0], uniswapFactory, weth)
		strategyFactory = platform.strategyFactory
		controller = platform.controller
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist

		adapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(adapter.address)
		router = await deployLoopRouter(accounts[0], controller)
		await whitelist.connect(accounts[0]).approve(router.address)
	})

	it('Should get implementation', async function () {
		const implementation = await platform.administration.controllerAdmin.implementation()
		expect(implementation).to.not.equal(AddressZero)
	})

	it('Should fail to deploy strategy: threshold too high', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) }
		] as Position[]
		const failItems = prepareStrategy(positions, adapter.address)
		const failState: StrategyState = {
			timelock: TIMELOCK,
			rebalanceThreshold: BigNumber.from(1001),
			slippage: SLIPPAGE,
			performanceFee: BigNumber.from(0),
			social: false
		}
		await expect(
			strategyFactory
				.connect(accounts[1])
				.createStrategy(
					accounts[1].address,
					'Fail Strategy',
					'FAIL',
					failItems,
					failState,
					router.address,
					'0x'
				)
		).to.be.revertedWith('Threshold high')
	})

	it('Should fail to deploy strategy: slippage too high', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) }
		] as Position[]
		const failItems = prepareStrategy(positions, adapter.address)
		const failState: StrategyState = {
			timelock: TIMELOCK,
			rebalanceThreshold: REBALANCE_THRESHOLD,
			slippage: BigNumber.from(1001),
			performanceFee: BigNumber.from(0),
			social: false
		}
		await expect(
			strategyFactory
				.connect(accounts[1])
				.createStrategy(
					accounts[1].address,
					'Fail Strategy',
					'FAIL',
					failItems,
					failState,
					router.address,
					'0x'
				)
		).to.be.revertedWith('Slippage high')
	})
	/*
	it('Should fail to deploy strategy: no weth', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) }
		] as Position[]
		const failItems = prepareStrategy(positions, adapter.address)
		const failState: StrategyState = {
			timelock: TIMELOCK,
			rebalanceThreshold: REBALANCE_THRESHOLD,
			slippage: SLIPPAGE,
			performanceFee: BigNumber.from(0),
			social: false
		}
		await expect(
			strategyFactory
				.connect(accounts[1])
				.createStrategy(
					accounts[1].address,
					'Fail Strategy',
					'FAIL',
					failItems,
					failState,
					router.address,
					'0x'
				)
		).to.be.revertedWith('No WETH')
	})
	*/
	it('Should deploy empty strategy', async function() {
		const strategyState: StrategyState = {
			timelock: TIMELOCK,
			rebalanceThreshold: REBALANCE_THRESHOLD,
			slippage: SLIPPAGE,
			performanceFee: BigNumber.from(10), //1% fee
			social: true // social
		}
		const tx = await strategyFactory
			.connect(accounts[2])
			.createStrategy(
				accounts[2].address,
				'Empty',
				'MT',
				[],
				strategyState,
				AddressZero,
				'0x'
			)
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		const emptyStrategy = await Strategy.attach(strategyAddress)
		expect((await emptyStrategy.items()).length).to.equal(0)
		expect(await controller.social(emptyStrategy.address)).to.equal(true)
		expect(BigNumber.from(await controller.performanceFee(emptyStrategy.address)).eq(strategyState.performanceFee)).to.equal(true)
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
			{ token: tokens[0].address, percentage: BigNumber.from(50) },
		] as Position[]
		strategyItems = prepareStrategy(positions, adapter.address)
		const strategyState: StrategyState = {
			timelock: TIMELOCK,
			rebalanceThreshold: REBALANCE_THRESHOLD,
			slippage: SLIPPAGE,
			performanceFee: BigNumber.from(0),
			social: false
		}
		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				strategyItems,
				strategyState,
				router.address,
				'0x',
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

	/*
	it('Should fail to setup strategy: initialized', async function () {
		const failState: StrategyState = {
			timelock: BigNumber.from(0),
			rebalanceThreshold: BigNumber.from(0),
			slippage: BigNumber.from(0),
			performanceFee: BigNumber.from(0),
			social: false
		}
		await expect(
			controller.setupStrategy(accounts[1].address, strategy.address, failState, router.address, '0x')
		).to.be.revertedWith('Already setup')
	})
	*/

	it('Should fail to setup strategy: initialized', async function () {
		const failState: StrategyState = {
			timelock: BigNumber.from(0),
			rebalanceThreshold: BigNumber.from(0),
			slippage: BigNumber.from(0),
			performanceFee: BigNumber.from(0),
			social: false
		}
		await expect(
			controller.setupStrategy(accounts[1].address, AddressZero, failState, router.address, '0x')
		).to.be.revertedWith('Not factory')
	})

	it('Should fail to verify structure: 0 address', async function () {
		const failPositions: Position[] = [
			{ token: tokens[0].address, percentage: BigNumber.from(0) },
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: AddressZero, percentage: BigNumber.from(500) }
		]
		const failItems = prepareStrategy(failPositions, adapter.address)
		await expect(controller.verifyStructure(strategy.address, failItems)).to.be.revertedWith('Invalid item addr')
	})

	it('Should fail to verify structure: out of order', async function () {
		const failPositions: Position[] = [
			{ token: tokens[0].address, percentage: BigNumber.from(0) },
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: AddressZero, percentage: BigNumber.from(500) }
		]
		const failItems = prepareStrategy(failPositions, adapter.address)
		const pos0 = failItems[0]
		const pos1 = failItems[1]
		// Switch order
		failItems[0] = pos1
		failItems[1] = pos0
		await expect(controller.verifyStructure(strategy.address, failItems)).to.be.revertedWith('Item ordering')
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
			controller.connect(accounts[1]).finalizeStructure(strategy.address, router.address, '0x')
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

	it('Should fail to update performance fee: not manager', async function () {
		await expect(
			controller.connect(accounts[0]).updateValue(strategy.address, TIMELOCK_CATEGORY.PERFORMANCE, 1)
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to update performance fee: value too large', async function () {
		await expect(
			controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.PERFORMANCE, 1001)
		).to.be.revertedWith('Value too high')
	})

	it('Should update performance fee', async function () {
		const fee = 10 // 1% fee
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.PERFORMANCE, fee)
		await controller.finalizeValue(strategy.address)
		expect(BigNumber.from(await controller.performanceFee(strategy.address)).eq(fee)).to.equal(true)
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
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		).to.be.revertedWith('Balanced')
	})

	it('Should purchase a token, requiring a rebalance', async function () {
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
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should fail to rebalance, router not approved', async function () {
		await expect(controller.connect(accounts[1]).rebalance(strategy.address, AddressZero, '0x')).to.be.revertedWith(
			'Router not approved'
		)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to rebalance, only manager may rebalance', async function () {
		await expect(
			controller.connect(accounts[2]).rebalance(strategy.address, router.address, '0x')
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to deposit: not manager', async function () {
		await expect(
			strategy.connect(accounts[0]).deposit(0, router.address, '0x', { value: BigNumber.from('10000000000000000') })
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to deposit: no funds deposited', async function () {
		await expect(
			strategy.connect(accounts[1]).deposit(0, router.address, '0x')
		).to.be.revertedWith('Lost value')
	})

	it('Should fail to deposit: value slipped', async function () {
		await expect(
			strategy.connect(accounts[1]).deposit(0, router.address, '0x', { value: BigNumber.from('1000') })
		).to.be.revertedWith('Value slipped')
	})

	it('Should deposit more: ETH', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[1].address)
		const tx = await strategy.connect(accounts[1]).deposit(0, router.address, '0x', { value: BigNumber.from('10000000000000000') })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[1].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should deposit more: weth', async function () {
		const amount = BigNumber.from('10000000000000000')
		await weth.connect(accounts[1]).deposit({value: amount})
		await weth.connect(accounts[1]).approve(router.address, amount)
		const balanceBefore = await strategy.balanceOf(accounts[1].address)
		const tx = await strategy.connect(accounts[1]).deposit(amount, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[1].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should fail to withdraw: no strategy tokens', async function () {
		await expect(strategy.connect(accounts[0]).withdrawAll(1)).to.be.revertedWith('ERC20: Amount exceeds balance')
	})

	it('Should fail to withdraw: no amount passed', async function () {
		await expect(strategy.connect(accounts[1]).withdrawAll(0)).to.be.revertedWith('0 amount')
	})

	it('Should withdraw', async function () {
		const amount = BigNumber.from('10000000000000')
		const supplyBefore = new BigNumJs((await strategy.totalSupply()).toString())
		const tokenBalanceBefore = new BigNumJs((await tokens[1].balanceOf(strategy.address)).toString())
		const tx = await strategy.connect(accounts[1]).withdrawAll(amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const supplyAfter = new BigNumJs((await strategy.totalSupply()).toString())
		const tokenBalanceAfter = new BigNumJs((await tokens[1].balanceOf(strategy.address)).toString())
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

	it('Should fail to restructure: wrong percentages', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(300) },
			{ token: tokens[1].address, percentage: BigNumber.from(300) },
			{ token: tokens[2].address, percentage: BigNumber.from(300) },
		] as Position[]
		const failItems = prepareStrategy(positions, adapter.address)
		await expect(
			controller.connect(accounts[1]).restructure(strategy.address, failItems)
		).to.be.revertedWith('Total percentage wrong')
	})

	it('Should fail to restructure: not manager', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(300) },
			{ token: tokens[1].address, percentage: BigNumber.from(300) },
			{ token: tokens[2].address, percentage: BigNumber.from(400) },
		] as Position[]
		const failItems = prepareStrategy(positions, adapter.address)
		await expect(
			controller.connect(accounts[2]).restructure(strategy.address, failItems)
		).to.be.revertedWith('Not manager')
	})

	it('Should restructure', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(300) },
			{ token: tokens[1].address, percentage: BigNumber.from(300) },
			{ token: tokens[2].address, percentage: BigNumber.from(400) },
		] as Position[]
		strategyItems = prepareStrategy(positions, adapter.address)
		await controller.connect(accounts[1]).restructure(strategy.address, strategyItems)
	})

	it('Should fail to finalize value: wrong category', async function () {
		await expect(controller.finalizeValue(strategy.address)).to.be.revertedWith('Wrong category')
	})
	/*
	it('Should fail to finalize structure: value slipped', async function () {
		const MaliciousAdapter = await getContractFactory('MaliciousAdapter')
		const maliciousAdapter = await MaliciousAdapter.connect(accounts[1]).deploy(weth.address)
		await maliciousAdapter.deployed()
		await whitelist.connect(accounts[0]).approve(maliciousAdapter.address)

		const [total, estimates] = await oracle.estimateStrategy(strategy.address)
		const currentItems = await strategy.items()
		const maliciousAdapters = currentItems.map(() => maliciousAdapter.address)

		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'address[]', 'address[]', 'address[]'], [total, estimates, currentItems, maliciousAdapters, strategyAdapters])

		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, router.address, data)
		).to.be.revertedWith('Value slipped')
	})
	*/
	it('Should finalize structure', async function () {
		await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, router.address, '0x')
		//await displayBalances(wrapper, strategyItems, weth)
	})

	it('Should have no token 3', async function () {
		const amount = await tokens[3].balanceOf(strategy.address);
		expect(amount.eq(0)).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance', async function () {
		if (strategyItems[0].item === weth.address) {
			const value = await tokens[1].balanceOf(accounts[2].address)
			await tokens[1].connect(accounts[2]).approve(adapter.address, value)
			await adapter
				.connect(accounts[2])
				.swap(value, 0, tokens[1].address, weth.address, accounts[2].address, accounts[2].address)
		} else {
			const value = WeiPerEther.mul(100)
			await weth.connect(accounts[2]).deposit({ value: value })
			await weth.connect(accounts[2]).approve(adapter.address, value)
			await adapter
				.connect(accounts[2])
				.swap(value, 0, weth.address, strategyItems[0].item, accounts[2].address, accounts[2].address)
		}

		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should fail to rebalance: not controller', async function () {
		await expect(router.rebalance(strategy.address, '0x')).to.be.revertedWith('Only controller')
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems, weth)
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

	it('Should deploy fail adapter + setup strategy to need rebalance', async function () {
		const FailAdapter = await getContractFactory('FailAdapter')
		failAdapter = await FailAdapter.deploy(weth.address)
		await failAdapter.deployed()

		const value = WeiPerEther.mul(100)
		await weth.connect(accounts[2]).deposit({ value: value })
		await weth.connect(accounts[2]).approve(adapter.address, value)
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, tokens[1].address, accounts[2].address, accounts[2].address)
	})
	/*
	it('Should fail to swap rebalance: adapter not approve', async function () {
		const failAdapters = strategyItems.map(() => failAdapter.address)
		const estimates = await Promise.all(
			strategyItems.map(async (strategyItem) => (await wrapper.getTokenValue(strategyItem.item)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'address[]'], [total, estimates, failAdapters])

		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
		).to.be.revertedWith('Not approved')

		// Approve
		await whitelist.connect(accounts[0]).approve(failAdapter.address)
	})

	it('Should fail to rebalance: fail adapter (_sellTokens)', async function () {
		const failAdapters = strategyItems.map(() => failAdapter.address)
		const estimates = await Promise.all(
			strategyItems.map(async (strategyItem) => (await wrapper.getTokenValue(strategyItem.item)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'address[]'], [total, estimates, failAdapters])

		await failAdapter.setSellFail(true)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
		).to.be.revertedWith('Swap failed')
		await failAdapter.setSellFail(false)
	})

	it('Should fail to rebalance: fail adapter (_buyTokens)', async function () {
		const failAdapters = strategyItems.map(() => failAdapter.address)
		const estimates = await Promise.all(
			strategyItems.map(async (strategyItem) => (await wrapper.getTokenValue(strategyItem.item)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'address[]'], [total, estimates, failAdapters])

		await failAdapter.setBuyFail(true)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
		).to.be.revertedWith('Swap failed')
		await failAdapter.setBuyFail(true)
	})

	it('Should fail to deposit: fail adapter', async function () {
		const failAdapters = strategyItems.map(() => failAdapter.address)
		const data = ethers.utils.defaultAbiCoder.encode(['bool', 'address[]'], [false, failAdapters])
		await expect(
			strategy.connect(accounts[1]).deposit(0, router.address, data, { value: WeiPerEther })
		).to.be.revertedWith('Swap failed')
	})
	*/
	it('Should restructure', async function () {
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(0) },
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[3].address, percentage: BigNumber.from(500) },
		] as Position[]

		strategyItems = prepareStrategy(positions, adapter.address)
		await controller.connect(accounts[1]).restructure(strategy.address, strategyItems)
	})
	/*
	it('Should fail to finalize: fail sell adapter', async function () {
		const [total, estimates] = await oracle.estimateStrategy(strategy.address)
		const currentItems = await strategy.items()
		const failAdapters = currentItems.map(() => failAdapter.address)

		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'address[]', 'address[]', 'address[]'], [total, estimates, currentItems, failAdapters, strategyAdapters])

		await failAdapter.setSellFail(true)
		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, router.address, data)
		).to.be.revertedWith('Swap failed')
		await failAdapter.setSellFail(false)
	})
	*/
	it('Should finalize structure', async function () {
		await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, router.address, '0x')
		//await displayBalances(wrapper, strategyItems, weth)
	})
	/*
	it('Should fail to rebalance: fail adapter (_buyTokens)', async function () {
		const value = tokens[1].balanceOf(accounts[2].address)
		await tokens[1].connect(accounts[2]).approve(adapter.address, value)
		await adapter
			.connect(accounts[2])
			.swap(value, 0, tokens[1].address, weth.address, accounts[2].address, accounts[2].address)

		const failAdapters = strategyItems.map(() => failAdapter.address)
		const estimates = await Promise.all(
			strategyItems.map(async (strategyItem) => (await wrapper.getTokenValue(strategyItem.item)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'address[]'], [total, estimates, failAdapters])

		await failAdapter.setBuyFail(true)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
		).to.be.revertedWith('Swap failed')
		await failAdapter.setBuyFail(true)
	})
	*/
})
