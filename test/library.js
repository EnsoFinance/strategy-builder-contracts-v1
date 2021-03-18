const { expect } = require('chai')
const { ethers } = require('hardhat')
const {
	deployUniswap,
	deployTokens,
	deployPlatform,
	deployUniswapAdapter,
	deployLoopRouter,
} = require('./helpers/deploy.js')
const { prepareStrategy } = require('./helpers/encode.js')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 15
let WETH
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 1209600 // Two weeks

describe('StrategyLibrary', function () {
	let tokens,
		accounts,
		uniswapFactory,
		strategyFactory,
		controller,
		oracle,
		whitelist,
		router,
		adapter,
		strategyTokens,
		strategyPercentages,
		strategyAdapters,
		wrapper

	before('Setup LibraryWrapper', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		uniswapFactory = await deployUniswap(accounts[0], tokens)
		adapter = await deployUniswapAdapter(accounts[0], uniswapFactory, WETH)
		;[strategyFactory, controller, oracle, whitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH)
		router = await deployLoopRouter(accounts[0], controller, adapter, WETH)
		await whitelist.connect(accounts[0]).approve(router.address)

		const positions = [
			{ token: tokens[1].address, percentage: 200 },
			{ token: tokens[2].address, percentage: 200 },
			{ token: tokens[3].address, percentage: 50 },
			{ token: tokens[4].address, percentage: 50 },
			{ token: tokens[5].address, percentage: 50 },
			{ token: tokens[6].address, percentage: 50 },
			{ token: tokens[7].address, percentage: 50 },
			{ token: tokens[8].address, percentage: 50 },
			{ token: tokens[9].address, percentage: 50 },
			{ token: tokens[10].address, percentage: 50 },
			{ token: tokens[11].address, percentage: 50 },
			{ token: tokens[12].address, percentage: 50 },
			{ token: tokens[13].address, percentage: 50 },
			{ token: tokens[14].address, percentage: 50 },
		]
		;[strategyTokens, strategyPercentages, strategyAdapters] = prepareStrategy(positions, adapter.address)
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])

		const total = ethers.BigNumber.from('10000000000000000')
		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				'Test Strategy',
				'TEST',
				strategyTokens,
				strategyPercentages,
				false,
				0,
				REBALANCE_THRESHOLD,
				SLIPPAGE,
				TIMELOCK,
				router.address,
				data,
				{ value: total }
			)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev) => ev.event === 'NewStrategy').args.strategy

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should not have ETH token value', async function () {
		const value = await wrapper.getTokenValue(AddressZero)
		expect(value.eq(0)).to.equal(true)
	})

	it('Should return range of 0', async function () {
		const value = await wrapper.getRange(100, 0)
		expect(value.eq(0)).to.equal(true)
	})
})
