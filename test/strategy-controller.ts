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
import { prepareStrategy, Position, StrategyItem, InitialState } from '../lib/encode'
import { DEFAULT_DEPOSIT_SLIPPAGE, ITEM_CATEGORY, ESTIMATOR_CATEGORY, TIMELOCK_CATEGORY } from '../lib/constants'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployLoopRouter, Platform } from '../lib/deploy'
//import { displayBalances } from '../lib/logging'

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = BigNumber.from(10) // 10/1000 = 1%
const REBALANCE_SLIPPAGE = BigNumber.from(997) // 995/1000 = 99.7%
const RESTRUCTURE_SLIPPAGE = BigNumber.from(995) // 995/1000 = 99.5%
const TIMELOCK = BigNumber.from(60) // 1 minute

chai.use(solidity)

describe('StrategyController', function () {
	let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		owner: SignerWithAddress,
		platform: Platform,
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		library: Contract,
		adapter: Contract,
		failAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		newThreshold: BigNumber

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		owner = accounts[0]
		tokens = await deployTokens(owner, NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(owner, tokens)
		platform = await deployPlatform(owner, uniswapFactory, new Contract(AddressZero, [], owner), weth)
		strategyFactory = platform.strategyFactory
		controller = platform.controller
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		library = platform.library

		adapter = await deployUniswapV2Adapter(owner, uniswapFactory, weth)
		await whitelist.connect(owner).approve(adapter.address)
		router = await deployLoopRouter(owner, controller, library)
		await whitelist.connect(owner).approve(router.address)
	})

	it('Should get implementation', async function () {
		const implementation = await platform.administration.platformProxyAdmin.controllerImplementation()
		expect(implementation).to.not.equal(AddressZero)
	})

	it('Should fail to deploy strategy: threshold too high', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) }
		] as Position[]
		const failItems = prepareStrategy(positions, adapter.address)
		const failState: InitialState = {
			timelock: TIMELOCK,
			rebalanceThreshold: BigNumber.from(1001),
			rebalanceSlippage: REBALANCE_SLIPPAGE,
			restructureSlippage: RESTRUCTURE_SLIPPAGE,
			performanceFee: BigNumber.from(0),
			social: false,
			set: false
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
		).to.be.revertedWith('Out of bounds')
	})

	it('Should fail to deploy strategy: slippage too high', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) }
		] as Position[]
		const failItems = prepareStrategy(positions, adapter.address)
		const failState: InitialState = {
			timelock: TIMELOCK,
			rebalanceThreshold: REBALANCE_THRESHOLD,
			rebalanceSlippage: BigNumber.from(1001),
			restructureSlippage: RESTRUCTURE_SLIPPAGE,
			performanceFee: BigNumber.from(0),
			social: false,
			set: false
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
		).to.be.revertedWith('Out of bounds')
	})

	it('Should fail to deploy strategy: slippage too high', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) }
		] as Position[]
		const failItems = prepareStrategy(positions, adapter.address)
		const failState: InitialState = {
			timelock: TIMELOCK,
			rebalanceThreshold: REBALANCE_THRESHOLD,
			rebalanceSlippage: REBALANCE_SLIPPAGE,
			restructureSlippage: BigNumber.from(1001),
			performanceFee: BigNumber.from(0),
			social: false,
			set: false
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
		).to.be.revertedWith('Out of bounds')
	})

	it('Should fail to deploy strategy: fee too high', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) }
		] as Position[]
		const failItems = prepareStrategy(positions, adapter.address)
		const failState: InitialState = {
			timelock: TIMELOCK,
			rebalanceThreshold: REBALANCE_THRESHOLD,
			rebalanceSlippage: REBALANCE_SLIPPAGE,
			restructureSlippage: RESTRUCTURE_SLIPPAGE,
			performanceFee: BigNumber.from(1001),
			social: true,
			set: false
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
		).to.be.revertedWith('Out of bounds')
	})

	it('Should deploy empty strategy', async function() {
		const strategyState: InitialState = {
			timelock: TIMELOCK,
			rebalanceThreshold: REBALANCE_THRESHOLD,
			rebalanceSlippage: REBALANCE_SLIPPAGE,
			restructureSlippage: RESTRUCTURE_SLIPPAGE,
			performanceFee: BigNumber.from(10), //1% fee
			social: true, // social
			set: false
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
		expect((await controller.strategyState(emptyStrategy.address)).social).to.equal(true)
		expect(BigNumber.from(await emptyStrategy.performanceFee()).eq(strategyState.performanceFee)).to.equal(true)
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
		const strategyState: InitialState = {
			timelock: TIMELOCK,
			rebalanceThreshold: REBALANCE_THRESHOLD,
			rebalanceSlippage: REBALANCE_SLIPPAGE,
			restructureSlippage: RESTRUCTURE_SLIPPAGE,
			performanceFee: BigNumber.from(0),
			social: false,
			set: false
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

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail on any and all external calls: StrategyControllerPaused', async function () {
		let platformProxyAdmin = platform.administration.platformProxyAdmin
		let controllerImplementation = await platformProxyAdmin.controllerImplementation()

		let StrategyControllerPaused = await getContractFactory('StrategyControllerPaused')
		let strategyControllerPaused = await StrategyControllerPaused.deploy(strategyFactory.address)
		await strategyControllerPaused.deployed()

		let controllerProxy = await platformProxyAdmin.controller()
		// "pause"
		await platformProxyAdmin.connect(owner).upgrade(controllerProxy, strategyControllerPaused.address)

		let controllerPaused = await StrategyControllerPaused.attach(controllerProxy)
		// we just demo one external call since its obvious this behavior will
		// occur on all other public/external calls, and replicating this entire test
		// suite is overkill
		await expect(controllerPaused.connect(accounts[1]).setStrategy(strategy.address)).to.be.revertedWith(
			'StrategyControllerPaused'
		)
		// reset to original controllerImplementation
		// "unpause"
		await platformProxyAdmin.connect(owner).upgrade(controllerProxy, controllerImplementation)
		// now all following tests will pass
	})

	it('Should fail to setup strategy: initialized', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const failState: InitialState = {
			timelock: BigNumber.from(0),
			rebalanceThreshold: BigNumber.from(0),
			rebalanceSlippage: BigNumber.from(0),
			restructureSlippage: BigNumber.from(0),
			performanceFee: BigNumber.from(0),
			social: false,
			set: false
		}
		await expect(
			strategyFactory
				.connect(accounts[1])
				.createStrategy(
					accounts[1].address,
					name,
					symbol,
					strategyItems,
					failState,
					router.address,
					'0x',
					{ value: BigNumber.from('10000000000000000') }
				)
		).to.be.revertedWith('')
	})

	it('Should fail to setup strategy: not factory', async function () {
		const failState: InitialState = {
			timelock: BigNumber.from(0),
			rebalanceThreshold: BigNumber.from(0),
			rebalanceSlippage: BigNumber.from(0),
			restructureSlippage: BigNumber.from(0),
			performanceFee: BigNumber.from(0),
			social: false,
			set: false
		}
		await expect(
			controller.setupStrategy(accounts[1].address, strategy.address, failState, router.address, '0x')
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
		await expect(controller.connect(accounts[1]).updateValue(strategy.address, 6, 0)).to.be.revertedWith('')
	})

	it('Should fail to update threshold: not manager', async function () {
		await expect(
			controller.connect(owner).updateValue(strategy.address, TIMELOCK_CATEGORY.THRESHOLD, 1)
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to update threshold: value too large', async function () {
		await expect(
			controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.THRESHOLD, 1001)
		).to.be.revertedWith('Out of bounds')
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
		expect(BigNumber.from(await strategy.rebalanceThreshold()).eq(REBALANCE_THRESHOLD)).to.equal(
			true
		)
		await controller.finalizeValue(strategy.address)
		expect(BigNumber.from(await strategy.rebalanceThreshold()).eq(newThreshold)).to.equal(true)
	})

	it('Should fail to update rebalance slippage: not manager', async function () {
		await expect(
			controller.connect(owner).updateValue(strategy.address, TIMELOCK_CATEGORY.REBALANCE_SLIPPAGE, 1)
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to update rebalance slippage: value too large', async function () {
		await expect(
			controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.REBALANCE_SLIPPAGE, 1001)
		).to.be.revertedWith('Out of bounds')
	})

	it('Should update rebalance slippage', async function () {
		const slippage = 990
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.REBALANCE_SLIPPAGE, slippage)
		await controller.finalizeValue(strategy.address)
		expect(BigNumber.from((await controller.strategyState(strategy.address)).rebalanceSlippage).eq(slippage)).to.equal(true)
	})

	it('Should fail to update restructure slippage: not manager', async function () {
		await expect(
			controller.connect(owner).updateValue(strategy.address, TIMELOCK_CATEGORY.RESTRUCTURE_SLIPPAGE, 1)
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to update restructure slippage: value too large', async function () {
		await expect(
			controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.RESTRUCTURE_SLIPPAGE, 1001)
		).to.be.revertedWith('Out of bounds')
	})

	it('Should update restructure slippage', async function () {
		const slippage = 990
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.RESTRUCTURE_SLIPPAGE, slippage)
		await controller.finalizeValue(strategy.address)
		expect(BigNumber.from((await controller.strategyState(strategy.address)).restructureSlippage).eq(slippage)).to.equal(true)
	})


	it('Should fail to update performance fee: not manager', async function () {
		await expect(
			controller.connect(owner).updateValue(strategy.address, TIMELOCK_CATEGORY.PERFORMANCE, 1)
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to update performance fee: value too large', async function () {
		await expect(
			controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.PERFORMANCE, 1001)
		).to.be.revertedWith('Out of bounds')
	})

	it('Should update performance fee', async function () {
		const fee = 10 // 1% fee
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.PERFORMANCE, fee)
		await controller.finalizeValue(strategy.address)
		expect(BigNumber.from(await strategy.performanceFee()).eq(fee)).to.equal(true)
	})

	it('Should fail to update timelock: not manager', async function () {
		await expect(
			controller.connect(owner).updateValue(strategy.address, TIMELOCK_CATEGORY.TIMELOCK, 1)
		).to.be.revertedWith('Not manager')
	})

	it('Should update timelock', async function () {
		const timelock = 0
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.TIMELOCK, timelock)
		await controller.finalizeValue(strategy.address)
		expect(BigNumber.from((await controller.strategyState(strategy.address)).timelock).eq(timelock)).to.equal(true)
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
			'Not approved'
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
			controller.connect(owner).deposit(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', { value: BigNumber.from('10000000000000000') })
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to deposit: no funds deposited', async function () {
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x')
		).to.be.revertedWith('Lost value')
	})

	it('Should fail to deposit: too much slippage', async function () {
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, router.address, 0, 1000, '0x', { value: BigNumber.from('1000') })
		).to.be.revertedWith('Too much slippage')
	})

	it('Should deposit more: ETH', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[1].address)
		const tx = await controller.connect(accounts[1]).deposit(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', { value: BigNumber.from('10000000000000000') })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[1].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should deposit more: WETH', async function () {
		const amount = BigNumber.from('10000000000000000')
		await weth.connect(accounts[1]).deposit({value: amount})
		await weth.connect(accounts[1]).approve(router.address, amount)
		const balanceBefore = await strategy.balanceOf(accounts[1].address)
		const tx = await controller.connect(accounts[1]).deposit(strategy.address, router.address, amount, DEFAULT_DEPOSIT_SLIPPAGE, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[1].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should fail to withdrawAll: no strategy tokens', async function () {
		await expect(strategy.connect(accounts[5]).withdrawAll(1)).to.be.revertedWith('ERC20: Amount exceeds balance')
	})

	it('Should fail to withdrawAll: no amount passed', async function () {
		await expect(strategy.connect(accounts[1]).withdrawAll(0)).to.be.revertedWith('0 amount')
	})

	it('Should fail to withdraw: no amount passed', async function () {
		await expect(controller.connect(accounts[1]).withdrawWETH(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x')).to.be.revertedWith('0 amount')
	})

	it('Should withdrawAll', async function () {
		const amount = BigNumber.from('10000000000000')
		const tokenBalanceBefore = new BigNumJs((await tokens[1].balanceOf(strategy.address)).toString())
		const tx = await strategy.connect(accounts[1]).withdrawAll(amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const tokenBalanceAfter = new BigNumJs((await tokens[1].balanceOf(strategy.address)).toString())
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
		const tx = await controller.connect(accounts[1]).restructure(strategy.address, strategyItems)
		const receipt = await tx.wait()
		console.log('Restructure Gas Used: ', receipt.gasUsed.toString())
	})

	it('Should fail to finalize value: wrong category', async function () {
		await expect(controller.finalizeValue(strategy.address)).to.be.revertedWith('Wrong category')
	})

	it('Should finalize structure', async function () {
		const tx = await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Finalize Structure Gas Used: ', receipt.gasUsed.toString())
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
		await expect(controller.connect(owner).openStrategy(strategy.address)).to.be.revertedWith(
			'Not manager'
		)
	})

	it('Should open strategy', async function () {
		await controller.connect(accounts[1]).openStrategy(strategy.address)
		expect((await controller.strategyState(strategy.address)).social).to.equal(true)
	})

	it('Should fail to open strategy: already open', async function () {
		await expect(controller.connect(accounts[1]).openStrategy(strategy.address)).to.be.revertedWith(
			'Strategy already open'
		)
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

	it('Should restructure', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(0) },
			{ token: tokens[3].address, percentage: BigNumber.from(500) },
		] as Position[]

		strategyItems = prepareStrategy(positions, adapter.address)
		await controller.connect(accounts[1]).restructure(strategy.address, strategyItems)
	})

	it('Should finalize structure', async function () {
		await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, router.address, '0x')
		//await displayBalances(wrapper, strategyItems, weth)
	})

	it('Transfer reserve token to require rebalance', async function () {
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		).to.be.revertedWith('Balanced')

		const value = WeiPerEther.div(1000)
		await tokens[2].connect(accounts[0]).transfer(strategy.address, value)
		expect(await wrapper.isBalanced()).to.equal(false)
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Transfer reserve weth to require rebalance', async function () {
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		).to.be.revertedWith('Balanced')

		const value = WeiPerEther.div(100)
		await weth.connect(accounts[4]).deposit({ value: value })
		await weth.connect(accounts[4]).transfer(strategy.address, value)
		expect(await wrapper.isBalanced()).to.equal(false)
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to estimate and require emergency estimator', async function () {
		const originalEstimate = await oracle['estimateItem(uint256,address)'](WeiPerEther, tokens[1].address)
		const emergencyEstimatorAddress = await platform.oracles.registries.tokenRegistry.estimators(ESTIMATOR_CATEGORY.BLOCKED)

		const GasBurnerEstimator = await getContractFactory('GasBurnerEstimator')
		const gasBurnerEstimator = await GasBurnerEstimator.deploy()
	  await gasBurnerEstimator.connect(owner).deployed()
		let tx = await strategyFactory.connect(owner).addEstimatorToRegistry(ESTIMATOR_CATEGORY.BLOCKED, gasBurnerEstimator.address)
	  await tx.wait()
		tx = await strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.BLOCKED, tokens[1].address)
	  await tx.wait()

		await expect(controller.connect(accounts[1]).deposit(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', { value: WeiPerEther})).to.be.revertedWith('')

		tx = await strategyFactory.connect(owner).addEstimatorToRegistry(ESTIMATOR_CATEGORY.BLOCKED, emergencyEstimatorAddress)
	  await tx.wait()

		await expect(controller.connect(accounts[1]).deposit(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', { value: WeiPerEther})).to.be.revertedWith('')

		const EmergencyEstimator = await getContractFactory('EmergencyEstimator')
		const emergencyEstimator = await EmergencyEstimator.attach(emergencyEstimatorAddress)
		await emergencyEstimator.setEstimate(tokens[1].address, originalEstimate)

		await expect(controller.connect(accounts[1]).deposit(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', { value: WeiPerEther})).to.emit(controller, 'Deposit')
	})

	it('Should set strategy', async function () {
		await expect(controller.connect(accounts[1]).setStrategy(strategy.address)).to.emit(controller, 'StrategySet')
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(1000) }
		] as Position[]
		strategyItems = prepareStrategy(positions, adapter.address)
		await expect(controller.connect(accounts[1]).restructure(strategy.address, strategyItems)).to.be.revertedWith('Strategy cannot change')
	})

	it('Should fail to set strategy: already set', async function () {
		await expect(controller.connect(accounts[1]).setStrategy(strategy.address)).to.be.revertedWith(
			'Strategy already set'
		)
	})

})
