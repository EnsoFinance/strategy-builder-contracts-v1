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
const {
	prepareStrategy,
	prepareRebalanceMulticall,
	prepareDepositMulticall,
	calculateAddress,
} = require('./helpers/encode.js')
const { prepareFlashLoan } = require('./helpers/cookbook.js')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 4
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 1209600 // Two weeks
let WETH

describe('Flash Loan', function () {
	let tokens,
		accounts,
		uniswapFactory,
		sushiFactory,
		strategyFactory,
		controller,
		oracle,
		whitelist,
		genericRouter,
		uniswapAdapter,
		sushiAdapter,
		arbitrager,
		strategy,
		strategyTokens,
		strategyPercentages,
		wrapper

	it('Setup Uniswap, Sushiswap, Factory, GenericRouter', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(200 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		uniswapFactory = await deployUniswap(accounts[0], tokens)
		sushiFactory = await deployUniswap(accounts[0], tokens)
		uniswapAdapter = await deployUniswapAdapter(accounts[0], uniswapFactory, WETH)
		sushiAdapter = await deployUniswapAdapter(accounts[0], sushiFactory, WETH)
		;[strategyFactory, controller, oracle, whitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH)
		genericRouter = await deployGenericRouter(accounts[0], controller, WETH)
		await whitelist.connect(accounts[0]).approve(genericRouter.address)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: 500 },
			{ token: tokens[2].address, percentage: 300 },
			{ token: tokens[3].address, percentage: 200 },
		]

		;[strategyTokens, strategyPercentages] = prepareStrategy(positions, uniswapAdapter.address)

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
			uniswapAdapter,
			uniswapFactory,
			WETH,
			total,
			strategyTokens,
			strategyPercentages
		)
		const data = await genericRouter.encodeCalls(calls)

		await strategyFactory
			.connect(accounts[1])
			.createStrategy(
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
				{ value: ethers.BigNumber.from('10000000000000000') }
			)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategy.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyTokens, WETH)
		//expect(await strategy.getStrategyValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deploy arbitrager contract', async function () {
		const Arbitrager = await getContractFactory('Arbitrager')
		arbitrager = await Arbitrager.connect(accounts[1]).deploy()
		await arbitrager.deployed()
		console.log('Arbitrager: ', arbitrager.address)
	})

	it('Should purchase a token, requiring a rebalance and create arbitrage opportunity', async function () {
		const value = WeiPerEther.mul(50)
		await uniswapAdapter
			.connect(accounts[2])
			.swap(value, 0, AddressZero, tokens[1].address, accounts[2].address, accounts[2].address, [], [], {
				value: value,
			})
		const tokenBalance = await tokens[1].balanceOf(accounts[2].address)
		await tokens[1].connect(accounts[2]).approve(sushiAdapter.address, tokenBalance)
		await sushiAdapter
			.connect(accounts[2])
			.swap(tokenBalance, 0, tokens[1].address, AddressZero, accounts[2].address, accounts[2].address, [], [])
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy with multicall + flash loan', async function () {
		console.log('Rebalancing strategy....')
		const balanceBefore = await tokens[1].balanceOf(accounts[1].address)
		// Multicall gets initial tokens from uniswap
		const rebalanceCalls = await prepareRebalanceMulticall(
			strategy,
			controller,
			genericRouter,
			uniswapAdapter,
			oracle,
			uniswapFactory,
			WETH
		)
		const flashLoanCalls = await prepareFlashLoan(
			strategy,
			arbitrager,
			uniswapAdapter,
			sushiAdapter,
			ethers.BigNumber.from('1000000000000000'),
			tokens[1],
			WETH
		)
		const calls = [...rebalanceCalls, ...flashLoanCalls]
		const data = await genericRouter.encodeCalls(calls)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, genericRouter.address, data)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await tokens[1].balanceOf(accounts[1].address)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
		console.log('Tokens Earned: ', balanceAfter.sub(balanceBefore).toString())
	})
})
