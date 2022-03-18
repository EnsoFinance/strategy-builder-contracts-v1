import { expect } from 'chai'
const hre = require('hardhat')
const { ethers } = hre
const { constants, getSigners, getContractFactory } = ethers
import * as deployer from '../lib/deploy'
import { prepareStrategy, Position, StrategyItem, InitialState } from '../lib/encode'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

const { AddressZero, WeiPerEther, MaxUint256 } = constants
const NUM_TOKENS = 3


describe('BalancerAdapter', function () {
	let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		balancerFactory: Contract,
		balancerRegistry: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		library: Contract,
		router: Contract,
		balancerAdapter: Contract,
		uniswapAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract

	it('Setup Balancer, Factory', async function () {
		accounts = await getSigners()
		tokens = await deployer.deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(200 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		;[balancerFactory, balancerRegistry] = await deployer.deployBalancer(accounts[0], tokens)
		uniswapFactory = await deployer.deployUniswapV2(accounts[0], tokens)
		const platform = await deployer.deployPlatform(accounts[0], uniswapFactory, new Contract(AddressZero, [], accounts[0]), weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		library = platform.library
		const whitelist = platform.administration.whitelist
		uniswapAdapter = await deployer.deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		balancerAdapter = await deployer.deployBalancerAdapter(accounts[0], balancerRegistry, weth)
		await whitelist.connect(accounts[0]).approve(uniswapAdapter.address)
		await whitelist.connect(accounts[0]).approve(balancerAdapter.address)
		router = await deployer.deployLoopRouter(accounts[0], controller, library)
		await whitelist.connect(accounts[0]).approve(router.address)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) },
		] as Position[];
		strategyItems = prepareStrategy(positions, balancerAdapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(995),
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
		const Strategy = await ethers.getContractFactory('Strategy')
		strategy = await Strategy.connect(accounts[0]).attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems, weth)
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
				accounts[0].address
			)
		).to.be.revertedWith('Tokens cannot match')
	})

	it('Should fail to swap: less than expected', async function () {
		const amount = WeiPerEther
		await tokens[1].approve(balancerAdapter.address, amount)
		await expect(
			balancerAdapter.swap(
				amount,
				MaxUint256,
				tokens[1].address,
				tokens[0].address,
				accounts[0].address,
				accounts[0].address
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
			accounts[0].address
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
			accounts[0].address
		)
		const token0BalanceAfter = await tokens[0].balanceOf(accounts[0].address)
		const token1BalanceAfter = await tokens[1].balanceOf(accounts[0].address)
		expect(token0BalanceBefore.lt(token0BalanceAfter)).to.equal(true)
		expect(token1BalanceBefore.gt(token1BalanceAfter)).to.equal(true)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems, weth)
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
			accounts[0].address
		)
		const token0BalanceAfter = await tokens[0].balanceOf(accounts[0].address)
		const token1BalanceAfter = await tokens[1].balanceOf(accounts[0].address)
		expect(token0BalanceBefore.gt(token0BalanceAfter)).to.equal(true)
		expect(token1BalanceBefore.lt(token1BalanceAfter)).to.equal(true)
	})
})
