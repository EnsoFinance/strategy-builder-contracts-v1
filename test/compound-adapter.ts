import chai from 'chai'
const { expect } = chai
import { ethers } from 'hardhat'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { prepareStrategy, StrategyItem, InitialState, TradeData } from '../lib/encode'
import { Tokens } from '../lib/tokens'
import {
	Platform,
	deployCompoundAdapter,
	deployUniswapV2Adapter,
	deployPlatform,
	deployLoopRouter,
} from '../lib/deploy'
import { DEFAULT_DEPOSIT_SLIPPAGE, MAINNET_ADDRESSES, ESTIMATOR_CATEGORY, ITEM_CATEGORY } from '../lib/constants'
// import { displayBalances } from '../lib/logging'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'

chai.use(solidity)

describe('CompoundAdapter', function () {
	let platform: Platform,
		weth: Contract,
		usdt: Contract,
		comp: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		controllerLibrary: Contract,
		uniswapAdapter: Contract,
		compoundAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		tokens: Tokens

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		usdt = new Contract(tokens.usdt, ERC20.abi, accounts[0])
		comp = new Contract(tokens.COMP, ERC20.abi, accounts[0])

		uniswapFactory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, accounts[0])
		platform = await deployPlatform(accounts[0], uniswapFactory, new Contract(AddressZero, [], accounts[0]), weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		controllerLibrary = platform.controllerLibrary
		const whitelist = platform.administration.whitelist
		const { tokenRegistry } = platform.oracles.registries

		await tokens.registerTokens(accounts[0], strategyFactory)

		router = await deployLoopRouter(accounts[0], controller, controllerLibrary)
		await whitelist.connect(accounts[0]).approve(router.address)
		uniswapAdapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapAdapter.address)
		compoundAdapter = await deployCompoundAdapter(
			accounts[0],
			new Contract(MAINNET_ADDRESSES.COMPOUND_COMPTROLLER, [], accounts[0]),
			weth,
			tokenRegistry,
			ESTIMATOR_CATEGORY.COMPOUND
		)
		await whitelist.connect(accounts[0]).approve(compoundAdapter.address)
		let tradeData: TradeData = {
			adapters: [],
			path: [],
			cache: '0x',
		}
		await strategyFactory
			.connect(accounts[0])
			.addItemDetailedToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.COMPOUND, tokens.cUSDT, tradeData, true)
		await strategyFactory
			.connect(accounts[0])
			.addItemDetailedToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.COMPOUND, tokens.cDAI, tradeData, true)
		tradeData.adapters.push(uniswapAdapter.address)
		await strategyFactory
			.connect(accounts[0])
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.DEFAULT_ORACLE,
				comp.address,
				tradeData,
				false
			)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(200) },
			{
				token: tokens.cUSDT,
				percentage: BigNumber.from(400),
				adapters: [uniswapAdapter.address, compoundAdapter.address],
				path: [tokens.usdt],
			},
			{
				token: tokens.cDAI,
				percentage: BigNumber.from(400),
				adapters: [uniswapAdapter.address, compoundAdapter.address],
				path: [tokens.dai],
			},
		]
		console.log('cDAI', tokens.cDAI)
		console.log('cUSDT', tokens.cUSDT)
		console.log('weth', weth.address)
		console.log('comp', comp.address)
		console.log('compAdapter', compoundAdapter.address)
		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(995),
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}

		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				ControllerLibrary: controllerLibrary.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		// await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(1000)
		await weth.connect(accounts[19]).deposit({ value: value })
		await weth.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, usdt.address, accounts[19].address, accounts[19].address)

		// await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		// await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = await usdt.balanceOf(accounts[19].address)
		await usdt.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, usdt.address, weth.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deposit more: ETH', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[1].address)
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', {
				value: BigNumber.from('10000000000000000'),
			})
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[1].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should claim rewards', async function () {
		const balanceBefore = await comp.balanceOf(strategy.address)
		const tx = await strategy.connect(accounts[1]).claimAll()
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await comp.balanceOf(strategy.address)
		expect(balanceAfter).to.be.gt(balanceBefore)
	})
})
