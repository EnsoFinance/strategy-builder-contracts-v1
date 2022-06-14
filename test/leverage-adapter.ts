// const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
import { expect } from 'chai'
import { ethers } from 'hardhat'
import {
	deployAaveV2Adapter,
	deployAaveV2DebtAdapter,
	deployUniswapV2Adapter,
	deployLeverage2XAdapter,
	deployPlatform,
	deployMulticallRouter
} from '../lib/deploy'
import { Tokens } from '../lib/tokens'
import {
	prepareStrategy,
	calculateAddress,
	encodeSettleSwap,
	Multicall,
	StrategyItem,
	InitialState
} from '../lib/encode'
import { MAINNET_ADDRESSES, ESTIMATOR_CATEGORY } from '../lib/constants'

import { displayBalances } from '../lib/logging'
import { Contract, BigNumber } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'

const { constants, getContractFactory, getSigners } = ethers
const { AddressZero } = constants

describe('Leverage2XAdapter', function () {
	let tokens: Tokens,
		weth: Contract,
		usdc: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		multicallRouter: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		library: Contract,
		uniswapAdapter: Contract,
		aaveV2Adapter: Contract,
		aaveV2DebtAdapter: Contract,
		leverageAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract

	before('Setup Uniswap, Factory, MulticallRouter', async function () {
		accounts = await getSigners()
		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		usdc = new Contract(tokens.usdc, ERC20.abi, accounts[0])
		uniswapFactory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, accounts[0])
		const platform = await deployPlatform(accounts[0], uniswapFactory, new Contract(AddressZero, [], accounts[0]), weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		library = platform.library
		const { tokenRegistry } = platform.oracles.registries
		await tokens.registerTokens(accounts[0], strategyFactory)

		const addressProvider = new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], accounts[0])

		uniswapAdapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapAdapter.address)
		aaveV2Adapter = await deployAaveV2Adapter(accounts[0], addressProvider, controller, weth, tokenRegistry, ESTIMATOR_CATEGORY.AAVE_V2)
		await whitelist.connect(accounts[0]).approve(aaveV2Adapter.address)
		aaveV2DebtAdapter = await deployAaveV2DebtAdapter(accounts[0], addressProvider, weth)
		await whitelist.connect(accounts[0]).approve(aaveV2DebtAdapter.address)
		leverageAdapter = await deployLeverage2XAdapter(accounts[0], uniswapAdapter, aaveV2Adapter, aaveV2DebtAdapter, addressProvider, usdc, weth)
		await whitelist.connect(accounts[0]).approve(leverageAdapter.address)
		multicallRouter = await deployMulticallRouter(accounts[0], controller)
		await whitelist.connect(accounts[0]).approve(multicallRouter.address)
	})

	it('Should deploy ETH2x strategy', async function () {
		const name = 'ETH2x Strategy'
		const symbol = 'ETH2x'
		const positions = [
			{ token: tokens.aWETH,
				percentage: BigNumber.from(2000),
				adapters: [aaveV2Adapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(
					['uint16'],
					[500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
				),
			},
			{ token: tokens.debtUSDC,
				percentage: BigNumber.from(-1000),
				adapters: [aaveV2DebtAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, tokens.weth],
				cache: ethers.utils.defaultAbiCoder.encode(
					['address[]'],
					[[tokens.aWETH]]
				),
			}
		]
		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(990),
			performanceFee: BigNumber.from(0),
			social: false,
			set: false
		}

		const create2Address = await calculateAddress(
			strategyFactory,
			accounts[1].address,
			name,
			symbol
		)
		const Strategy = await getContractFactory('Strategy')
		strategy = Strategy.attach(create2Address)

		const total = ethers.BigNumber.from('10000000000000000')

		const calls = [] as Multicall[]
		calls.push(
			encodeSettleSwap(
				multicallRouter,
				leverageAdapter.address,
				weth.address,
				tokens.aWETH,
				controller.address,
				strategy.address
			)
		)
		const data = await multicallRouter.encodeCalls(calls)

		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				name,
				symbol,
				strategyItems,
				strategyState,
				multicallRouter.address,
				data,
				{ value: total }
			)
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategy.address)
		await wrapper.deployed()

		await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		//expect(await strategy.getStrategyValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deploy BTC2X strategy', async function () {
		const name = 'BTC2X Strategy'
		const symbol = 'BTC2X'
		const positions = [
			{ token: tokens.aWBTC,
				percentage: BigNumber.from(2000),
				adapters: [aaveV2Adapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(
					['uint16'],
					[500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
				),
			},
			{ token: tokens.debtUSDC,
				percentage: BigNumber.from(-1000),
				adapters: [aaveV2DebtAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, tokens.weth],
				cache: ethers.utils.defaultAbiCoder.encode(
					['address[]'],
					[[tokens.aWBTC]]
				),
			}
		]
		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(990),
			performanceFee: BigNumber.from(0),
			social: false,
			set: false
		}

		const create2Address = await calculateAddress(
			strategyFactory,
			accounts[1].address,
			name,
			symbol
		)
		const Strategy = await getContractFactory('Strategy')
		strategy = Strategy.attach(create2Address)

		const total = ethers.BigNumber.from('10000000000000000')

		const calls = [] as Multicall[]
		// First trade WETH for WBTC
		calls.push(
			encodeSettleSwap(
				multicallRouter,
				uniswapAdapter.address,
				weth.address,
				tokens.wbtc,
				controller.address,
				multicallRouter.address
			)
		)
		calls.push(
			encodeSettleSwap(
				multicallRouter,
				leverageAdapter.address,
				tokens.wbtc,
				tokens.aWBTC,
				multicallRouter.address,
				strategy.address
			)
		)
		const data = await multicallRouter.encodeCalls(calls)

		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				name,
				symbol,
				strategyItems,
				strategyState,
				multicallRouter.address,
				data,
				{ value: total }
			)
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategy.address)
		await wrapper.deployed()

		await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		//expect(await strategy.getStrategyValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
		expect(await wrapper.isBalanced()).to.equal(true)
	})
})
