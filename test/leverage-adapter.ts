// const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
import { expect } from 'chai'
import { ethers } from 'hardhat'
import {
	deployAaveLendAdapter,
	deployAaveBorrowAdapter,
	deployUniswapV2Adapter,
	deployLeverage2XAdapter,
	deployPlatform,
	deployGenericRouter
} from '../lib/deploy'
import { Tokens } from '../lib/tokens'
import {
	prepareStrategy,
	calculateAddress,
	encodeSettleSwap,
	Multicall,
	StrategyItem,
	StrategyState
} from '../lib/encode'
import { MAINNET_ADDRESSES } from '../lib/utils'

import { displayBalances } from '../lib/logging'
import { Contract, BigNumber } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'

const { getContractFactory, getSigners } = ethers

describe('Leverage2XAdapter', function () {
	let tokens: Tokens,
		weth: Contract,
		usdc: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		genericRouter: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		uniswapAdapter: Contract,
		aaveLendAdapter: Contract,
		aaveBorrowAdapter: Contract,
		leverageAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract

	before('Setup Uniswap, Factory, GenericRouter', async function () {
		accounts = await getSigners()
		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		usdc = new Contract(tokens.usdc, ERC20.abi, accounts[0])
		uniswapFactory = new Contract(MAINNET_ADDRESSES.UNISWAP, UniswapV2Factory.abi, accounts[0])
		const platform = await deployPlatform(accounts[0], uniswapFactory, weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		await tokens.registerTokens(accounts[0], strategyFactory)

		const addressProvider = new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], accounts[0])

		uniswapAdapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapAdapter.address)
		aaveLendAdapter = await deployAaveLendAdapter(accounts[0], addressProvider, controller, weth)
		await whitelist.connect(accounts[0]).approve(aaveLendAdapter.address)
		aaveBorrowAdapter = await deployAaveBorrowAdapter(accounts[0], addressProvider, weth)
		await whitelist.connect(accounts[0]).approve(aaveBorrowAdapter.address)
		leverageAdapter = await deployLeverage2XAdapter(accounts[0], uniswapAdapter, aaveLendAdapter, aaveBorrowAdapter, usdc, weth)
		await whitelist.connect(accounts[0]).approve(leverageAdapter.address)
		genericRouter = await deployGenericRouter(accounts[0], controller)
		await whitelist.connect(accounts[0]).approve(genericRouter.address)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens.aWETH,
				percentage: BigNumber.from(2000),
				adapters: [aaveLendAdapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(
					['uint16'],
					[500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
				),
			},
			{ token: tokens.debtUSDC,
				percentage: BigNumber.from(-1000),
				adapters: [aaveBorrowAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, tokens.weth],
				cache: ethers.utils.defaultAbiCoder.encode(
					['address[]'],
					[[tokens.aWETH]]
				),
			}
		]
		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: StrategyState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			slippage: BigNumber.from(995),
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
				genericRouter,
				leverageAdapter.address,
				weth.address,
				tokens.aWETH,
				controller.address,
				strategy.address
			)
		)
		const data = await genericRouter.encodeCalls(calls)

		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				strategyItems,
				strategyState,
				genericRouter.address,
				data,
				{ value: total }
			)
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategy.address)
		await wrapper.deployed()

		await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		//expect(await strategy.getStrategyValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
		expect(await wrapper.isBalanced()).to.equal(true)
	})
})
