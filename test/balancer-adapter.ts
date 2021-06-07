import { expect } from 'chai'
const hre = require('hardhat')
const { ethers } = hre
const { constants, getSigners } = ethers
import * as deployer from '../lib/deploy'
import { StrategyBuilder, Position } from '../lib/encode'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

const { WeiPerEther } = constants
const NUM_TOKENS = 3
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH: Contract


describe('BalancerAdapter', function () {
	let tokens: Contract[],
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		balancerFactory: Contract,
		balancerRegistry: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		router: Contract,
		balancerAdapter: Contract,
		uniswapAdapter: Contract,
		strategy: Contract,
		strategyTokens: string[],
		strategyPercentages: BigNumber[],
		strategyAdapters: string[],
		wrapper: Contract

	it('Setup Balancer, Factory', async function () {
		accounts = await getSigners()
		tokens = await deployer.deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(200 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		;[balancerFactory, balancerRegistry] = await deployer.deployBalancer(accounts[0], tokens)
		uniswapFactory = await deployer.deployUniswapV2(accounts[0], tokens)
		const platform = await deployer.deployPlatform(accounts[0], uniswapFactory, WETH)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracle
		whitelist = platform.whitelist
		uniswapAdapter = await deployer.deployUniswapV2Adapter(accounts[0], uniswapFactory, WETH)
		balancerAdapter = await deployer.deployBalancerAdapter(accounts[0], balancerRegistry, WETH)
		router = await deployer.deployLoopRouter(accounts[0], controller, balancerAdapter, WETH)
		await whitelist.connect(accounts[0]).approve(router.address)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) },
		] as Position[];
		const s = new StrategyBuilder(positions, balancerAdapter.address)
		strategyTokens = s.tokens
		strategyAdapters = s.adapters
		strategyPercentages = s.percentages
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
		const Strategy = await ethers.getContractFactory('Strategy')
		strategy = await Strategy.connect(accounts[0]).attach(strategyAddress)

		const LibraryWrapper = await ethers.getContractFactory('LibraryWrapper')
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
		const expected = BigNumber.from(
			await balancerAdapter.swapPrice(amount, tokens[1].address, tokens[0].address)
		).add(1)
		await tokens[1].approve(balancerAdapter.address, amount)
		await expect(
			balancerAdapter.swap(
				amount,
				expected,
				tokens[1].address,
				tokens[0].address,
				accounts[0].address,
				accounts[0].address,
				'0x',
				'0x'
			)
		).to.be.revertedWith('ERR_LIMIT_OUT')
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
		const estimates: BigNumber[] = await Promise.all(
			strategyTokens.map(async (token: string) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber.from(total.toString()).add(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should create a new pool', async function () {
		const tx = await balancerFactory.newBPool()
		const receipt = await tx.wait()
		const poolAddress = receipt.events[0].args.pool
		const Pool = await ethers.getContractFactory('BPool')
		const pool = await Pool.attach(poolAddress)
		await tokens[0].approve(poolAddress, WeiPerEther)
		await tokens[1].approve(poolAddress, WeiPerEther)
		await pool.bind(tokens[0].address, WeiPerEther, WeiPerEther.mul(5))
		await pool.bind(tokens[1].address, WeiPerEther, WeiPerEther.mul(5))
		await pool.finalize()
		await balancerRegistry.addPoolPair(poolAddress, tokens[0].address, tokens[1].address)
		await balancerRegistry.sortPools([tokens[0].address, tokens[1].address], 3)
	})

	it('Should swap with multiple pools', async function () {
		const token0BalanceBefore = await tokens[0].balanceOf(accounts[0].address)
		const token1BalanceBefore = await tokens[1].balanceOf(accounts[0].address)
		await tokens[0].approve(balancerAdapter.address, token0BalanceBefore)
		await balancerAdapter.swap(
			BigNumber.from('10000000000000000000'),
			0,
			tokens[0].address,
			tokens[1].address,
			accounts[0].address,
			accounts[0].address,
			'0x',
			'0x'
		)
		const token0BalanceAfter = await tokens[0].balanceOf(accounts[0].address)
		const token1BalanceAfter = await tokens[1].balanceOf(accounts[0].address)
		expect(token0BalanceBefore.gt(token0BalanceAfter)).to.equal(true)
		expect(token1BalanceBefore.lt(token1BalanceAfter)).to.equal(true)
	})
})
