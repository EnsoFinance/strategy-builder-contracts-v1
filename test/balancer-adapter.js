const BigNumber = require('bignumber.js')
const { expect } = require('chai')
const { ethers } = require('hardhat')
//const { displayBalances } = require('./helpers/logging.js')
const {
	deployBalancer,
	deployUniswap,
	deployTokens,
	deployBalancerAdapter,
	deployUniswapAdapter,
	deployLoopRouter,
	deployPlatform
} = require('./helpers/deploy.js')
const { prepareStrategy } = require('./helpers/encode.js')
const { constants, getContractFactory, getSigners } = ethers
const { WeiPerEther } = constants

const NUM_TOKENS = 3
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH

describe('BalancerAdapter', function () {
	let tokens,
		accounts,
		uniswapFactory,
		balancerRegistry,
		strategyFactory,
		controller,
		oracle,
		whitelist,
		router,
		balancerAdapter,
		uniswapAdapter,
		strategy,
		strategyTokens,
		strategyPercentages,
		strategyAdapters,
		wrapper

	it('Setup Balancer, Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(200 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		;[ , balancerRegistry] = await deployBalancer(accounts[0], tokens)
		uniswapFactory = await deployUniswap(accounts[0], tokens)
		;[strategyFactory, controller, oracle, whitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH)
		uniswapAdapter = await deployUniswapAdapter(accounts[0], uniswapFactory, WETH)
		balancerAdapter = await deployBalancerAdapter(accounts[0], balancerRegistry, tokens[0])
		router = await deployLoopRouter(accounts[0], controller, balancerAdapter, WETH)
		await whitelist.connect(accounts[0]).approve(router.address)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: 500 },
			{ token: tokens[2].address, percentage: 500 }
		]
		;[strategyTokens, strategyPercentages, strategyAdapters] = prepareStrategy(positions, balancerAdapter.address)
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
				{ value: ethers.BigNumber.from('10000000000000000') }
			)
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to swap: tokens cannot match', async function () {
		await expect(
			balancerAdapter.swap(
				1,
				0,
				tokens[0].address,
				tokens[0].address,
				accounts[0].address,
				accounts[0].address,
				'0x',
				'0x'
			)
		).to.be.revertedWith('Tokens cannot match')
	})

	it('Should fail to swap: less than expected', async function () {
		const amount = WeiPerEther
		const expected = ethers.BigNumber.from(await balancerAdapter.swapPrice(amount, tokens[1].address, tokens[0].address)).add(1)
		await tokens[1].approve(balancerAdapter.address, amount)
		await expect(balancerAdapter.swap(
			amount,
			expected,
			tokens[1].address,
			tokens[0].address,
			accounts[0].address,
			accounts[0].address,
			'0x',
			'0x'
		)).to.be.revertedWith('ERR_LIMIT_OUT')
	})


	it('Should swap token for token', async function () {
		const amount = WeiPerEther.mul(40)
		await tokens[1].approve(balancerAdapter.address, amount)
		const token0BalanceBefore = await tokens[0].balanceOf(accounts[0].address)
		const token1BalanceBefore = await tokens[1].balanceOf(accounts[0].address)
		await balancerAdapter.swap(
			amount,
			0,
			tokens[1].address,
			tokens[0].address,
			accounts[0].address,
			accounts[0].address,
			'0x',
			'0x'
		)
		const token0BalanceAfter = await tokens[0].balanceOf(accounts[0].address)
		const token1BalanceAfter = await tokens[1].balanceOf(accounts[0].address)
		expect(token0BalanceBefore.lt(token0BalanceAfter)).to.equal(true)
		expect(token1BalanceBefore.gt(token1BalanceAfter)).to.equal(true)
	})

	it('Should swap token on uniswap, requiring a rebalance (since oracle is based off uniswap)', async function () {
		const amount = WeiPerEther.mul(40)
		await tokens[1].approve(uniswapAdapter.address, amount)
		const token0BalanceBefore = await tokens[0].balanceOf(accounts[0].address)
		const token1BalanceBefore = await tokens[1].balanceOf(accounts[0].address)
		await uniswapAdapter.swap(
			amount,
			0,
			tokens[1].address,
			tokens[0].address,
			accounts[0].address,
			accounts[0].address,
			'0x',
			'0x'
		)
		const token0BalanceAfter = await tokens[0].balanceOf(accounts[0].address)
		const token1BalanceAfter = await tokens[1].balanceOf(accounts[0].address)
		expect(token0BalanceBefore.lt(token0BalanceAfter)).to.equal(true)
		expect(token1BalanceBefore.gt(token1BalanceAfter)).to.equal(true)
	})

	it('Should rebalance strategy', async function () {
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

})
