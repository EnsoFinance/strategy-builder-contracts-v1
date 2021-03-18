const { expect } = require('chai')
const { ethers } = require('hardhat')
//const { displayBalances } = require('./helpers/logging.js')
const {
	deployUniswap,
	deployTokens,
	deployPlatform,
	deployUniswapAdapter,
	deployGenericRouter,
} = require('./helpers/deploy.js')
const { prepareStrategy, prepareDepositMulticall, calculateAddress, encodeSettleSwap } = require('./helpers/encode.js')
const { constants, getContractFactory, getSigners } = ethers
const { WeiPerEther } = constants

const NUM_TOKENS = 3
let WETH
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 1209600 // Two weeks

describe('Reentrancy    ', function () {
	let tokens,
		accounts,
		uniswapFactory,
		strategyFactory,
		controller,
		oracle,
		whitelist,
		genericRouter,
		adapter,
		strategy,
		strategyTokens,
		strategyPercentages,
		wrapper

	before('Setup Uniswap, Factory, GenericRouter, DSProxy', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		uniswapFactory = await deployUniswap(accounts[0], tokens)
		adapter = await deployUniswapAdapter(accounts[0], uniswapFactory, WETH)
		;[strategyFactory, controller, oracle, whitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH)
		genericRouter = await deployGenericRouter(accounts[0], controller, WETH)
		await whitelist.connect(accounts[0]).approve(genericRouter.address)
	})
	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: 500 },
			{ token: tokens[2].address, percentage: 500 },
		]
		;[strategyTokens, strategyPercentages] = prepareStrategy(positions, adapter.address)

		const create2Address = await calculateAddress(
			strategyFactory,
			accounts[1].address,
			name,
			symbol,
			strategyTokens,
			strategyPercentages
		)
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(create2Address)

		const total = ethers.BigNumber.from('10000000000000000')
		const calls = await prepareDepositMulticall(
			strategy,
			controller,
			genericRouter,
			adapter,
			uniswapFactory,
			WETH,
			total,
			strategyTokens,
			strategyPercentages
		)
		const data = await genericRouter.encodeCalls(calls)

		let tx = await strategyFactory
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
				genericRouter.address,
				data,
				{ value: total }
			)
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategy.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyTokens, WETH)
		//expect(await strategy.getStrategyValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(50)
		await WETH.connect(accounts[2]).deposit({value: value})
		await WETH.connect(accounts[2]).approve(adapter.address, value)
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, tokens[1].address, accounts[2].address, accounts[2].address, [], [])
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('fail to reenter deposit fn', async function () {
		const total = ethers.BigNumber.from('10000000000000000')
		const calls = []
		const depositCalls = await prepareDepositMulticall(
			strategy,
			controller,
			genericRouter,
			adapter,
			uniswapFactory,
			WETH,
			total,
			strategyTokens,
			strategyPercentages
		)
		calls.push(...depositCalls)
		let secondDeposit = await genericRouter.encodeCalls(calls)
		let depositCalldata = await controller.interface.encodeFunctionData('deposit', [
			strategy.address,
			genericRouter.address,
			secondDeposit,
		])
		calls.push({ target: controller.address, callData: depositCalldata, value: 0 })
		let data = await genericRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, genericRouter.address, data, { value: total })
		).to.be.revertedWith()
	})

	it('fail to siphon tokens with settle swap', async function () {
		const total = ethers.BigNumber.from('10000000000000000')
		const token1Balance = await tokens[1].balanceOf(accounts[1].address)
		const token2Balance = await tokens[2].balanceOf(accounts[1].address)
		const calls = []
		const depositCalls = await prepareDepositMulticall(
			strategy,
			controller,
			genericRouter,
			adapter,
			uniswapFactory,
			WETH,
			total,
			strategyTokens,
			strategyPercentages
		)
		calls.push(...depositCalls)

		calls.push(
			await encodeSettleSwap(
				genericRouter,
				adapter.address,
				tokens[2].address,
				tokens[1].address,
				strategy.address,
				accounts[1].address
			)
		)

		let data = await genericRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, genericRouter.address, data, { value: total })
		).to.be.revertedWith()

		// Remove last call
		calls.pop()
		data = await genericRouter.encodeCalls(calls)

		// Deposit should work now
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, genericRouter.address, data, { value: total })
		const receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())

		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await tokens[1].balanceOf(accounts[1].address)).to.equal(token1Balance)
		expect(await tokens[2].balanceOf(accounts[1].address)).to.equal(token2Balance)
	})
})
