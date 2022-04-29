const { expect } = require('chai')
const { ethers } = require('hardhat')
//const { displayBalances } = require('../sri/logging.ts')
import {
	deployUniswapV2,
	deploySushiswap,
	deployTokens,
	deployPlatform,
	deployUniswapV2Adapter,
	deployMulticallRouter,
} from '../lib/deploy'
import {
	prepareStrategy,
	prepareRebalanceMulticall,
	prepareDepositMulticall,
	calculateAddress,
	Position,
	InitialState,
} from '../lib/encode'
import { prepareFlashLoan } from '../lib/cookbook'
import { Contract, BigNumber } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 4

describe('Flash Loan', function () {
	let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		arbitrager: Contract,
		multicallRouter: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		library: Contract,
		sushiAdapter: Contract,
		sushiFactory: Contract,
		uniswapAdapter: Contract,
		strategy: Contract,
		wrapper: Contract

	it('Setup Uniswap, Sushiswap, Factory, MulticallRouter', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(200 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[0], tokens)
		sushiFactory = await deploySushiswap(accounts[0], tokens)
		const platform = await deployPlatform(
			accounts[0],
			uniswapFactory,
			new Contract(AddressZero, [], accounts[0]),
			weth
		)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		library = platform.library
		uniswapAdapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		sushiAdapter = await deployUniswapV2Adapter(accounts[0], sushiFactory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapAdapter.address)
		await whitelist.connect(accounts[0]).approve(sushiAdapter.address)
		multicallRouter = await deployMulticallRouter(accounts[0], controller)
		await whitelist.connect(accounts[0]).approve(multicallRouter.address)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(300) },
			{ token: tokens[3].address, percentage: BigNumber.from(200) },
		] as Position[]
		const strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			rebalanceSlippage: BigNumber.from(995),
			restructureSlippage: BigNumber.from(995),
			performanceFee: BigNumber.from(0),
			social: false,
			set: false,
		}
		const create2Address = await calculateAddress(strategyFactory, accounts[1].address, name, symbol)
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(create2Address)

		const total = ethers.BigNumber.from('10000000000000000')
		const calls = await prepareDepositMulticall(
			strategy,
			controller,
			multicallRouter,
			uniswapAdapter,
			weth,
			total,
			strategyItems
		)
		const data = await multicallRouter.encodeCalls(calls)

		await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				strategyItems,
				strategyState,
				multicallRouter.address,
				data,
				{ value: ethers.BigNumber.from('10000000000000000') }
			)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategy.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyConfig.strategyItems, weth)
		//expect(await strategy.getStrategyValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deploy arbitrager contract', async function () {
		const Arbitrager = await getContractFactory('Arbitrager')
		arbitrager = await Arbitrager.connect(accounts[1]).deploy()
		await arbitrager.deployed()
	})

	it('Should purchase a token, requiring a rebalance and create arbitrage opportunity', async function () {
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value })
		await weth.connect(accounts[2]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, tokens[1].address, accounts[2].address, accounts[2].address)
		const tokenBalance = await tokens[1].balanceOf(accounts[2].address)
		await tokens[1].connect(accounts[2]).approve(sushiAdapter.address, tokenBalance)
		await sushiAdapter
			.connect(accounts[2])
			.swap(tokenBalance, 0, tokens[1].address, weth.address, accounts[2].address, accounts[2].address)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy with multicall + flash loan', async function () {
		const balanceBefore = await tokens[1].balanceOf(accounts[1].address)
		// Multicall gets initial tokens from uniswap
		const rebalanceCalls = await prepareRebalanceMulticall(strategy, multicallRouter, uniswapAdapter, oracle, weth)
		const flashLoanCalls = await prepareFlashLoan(
			strategy,
			arbitrager,
			uniswapAdapter,
			sushiAdapter,
			ethers.BigNumber.from('1000000000000000'),
			tokens[1],
			weth
		)
		const calls = [...rebalanceCalls, ...flashLoanCalls]
		const data = await multicallRouter.encodeCalls(calls)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, multicallRouter.address, data)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await tokens[1].balanceOf(accounts[1].address)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
		console.log('Tokens Earned: ', balanceAfter.sub(balanceBefore).toString())
	})
})
