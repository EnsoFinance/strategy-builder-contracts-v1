import chai from 'chai'
const { expect } = chai
import { ethers } from 'hardhat'
import { BigNumber, Event } from 'ethers'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero } = constants
import { solidity } from 'ethereum-waffle'
import { Contract } from 'ethers'
import { Tokens } from '../lib/tokens'
import { ESTIMATOR_CATEGORY, ITEM_CATEGORY, MAINNET_ADDRESSES } from '../lib/constants'
import { prepareStrategy, InitialState } from '../lib/encode'
import { deployUniswapV2Adapter, deployPlatform, deployLoopRouter } from '../lib/deploy'
//import { displayBalances } from '../lib/logging'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
chai.use(solidity)

describe('TokenRegistry', function () {
	before('Setup Uniswap + Factory', async function () {
		this.accounts = await getSigners()
		this.tokens = new Tokens()
		this.weth = new Contract(this.tokens.weth, WETH9.abi, this.accounts[0])
		this.uniswapFactory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, this.accounts[0])
		const susd = new Contract(this.tokens.sUSD, ERC20.abi, this.accounts[0])
		const platform = await deployPlatform(
			this.accounts[0],
			this.uniswapFactory,
			new Contract(AddressZero, [], this.accounts[0]),
			this.weth,
			susd
		)
		this.factory = platform.strategyFactory
		this.controller = platform.controller
		this.oracle = platform.oracles.ensoOracle
		this.whitelist = platform.administration.whitelist
		this.library = platform.library
		this.tokenRegistry = platform.oracles.registries.tokenRegistry

		const { curveDepositZapRegistry, chainlinkRegistry } = platform.oracles.registries
		await this.tokens.registerTokens(
			this.accounts[0],
			this.factory,
			undefined,
			chainlinkRegistry,
			curveDepositZapRegistry
		)

		this.router = await deployLoopRouter(this.accounts[0], this.controller, this.library)
		await this.whitelist.connect(this.accounts[0]).approve(this.router.address)
		this.uniswapAdapter = await deployUniswapV2Adapter(this.accounts[0], this.uniswapFactory, this.weth)
		await this.whitelist.connect(this.accounts[0]).approve(this.uniswapAdapter.address)
	})

	it('Should add default estimator to unknown index', async function () {
		const estimator = await this.tokenRegistry.getEstimator(this.tokens.usdt)
		const category = await this.tokenRegistry.estimatorCategories(this.tokens.usdt)
		expect(category).to.eq(ESTIMATOR_CATEGORY.DEFAULT_ORACLE)
		const newEnum = ESTIMATOR_CATEGORY.YEARN_V2 + 1
		await this.factory.addEstimatorToRegistry(newEnum, estimator)
		await this.factory.addItemToRegistry(ITEM_CATEGORY.BASIC, newEnum, this.tokens.usdt)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [{ token: this.tokens.usdt, percentage: BigNumber.from(1000) }]
		const strategyItems = prepareStrategy(positions, this.uniswapAdapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(995),
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}
		const tx = await this.factory
			.connect(this.accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, this.router.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		this.strategy = await Strategy.attach(strategyAddress)

		expect(await this.controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: this.library.address,
			},
		})
		this.wrapper = await LibraryWrapper.deploy(this.oracle.address, strategyAddress)
		await this.wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await this.wrapper.isBalanced()).to.equal(true)
	})

	it('Only owner can call', async function () {
		const itemCategories = [ITEM_CATEGORY.BASIC, ITEM_CATEGORY.BASIC]
		const estimatorCategories = [ESTIMATOR_CATEGORY.AAVE_V2, ESTIMATOR_CATEGORY.COMPOUND]
		const tokens = [this.tokens.aWETH, this.tokens.cUSDC]
		await expect(
			this.factory
				.connect(this.accounts[5].address)
				.addItemsToRegistry(itemCategories, estimatorCategories, tokens)
		).to.be.revertedWith('Not owner')
	})

	it('Should add a batch of tokens', async function () {
		const itemCategories = [ITEM_CATEGORY.BASIC, ITEM_CATEGORY.BASIC]
		const estimatorCategories = [ESTIMATOR_CATEGORY.AAVE_V2, ESTIMATOR_CATEGORY.COMPOUND]
		const tokens = [this.tokens.aWETH, this.tokens.cUSDC]
		await this.factory.addItemsToRegistry(itemCategories, estimatorCategories, tokens)
		const results = await Promise.all([
			this.tokenRegistry.estimatorCategories(this.tokens.aWETH),
			this.tokenRegistry.estimatorCategories(this.tokens.cUSDC),
			this.tokenRegistry.itemCategories(this.tokens.aWETH),
			this.tokenRegistry.itemCategories(this.tokens.cUSDC),
		])
		expect(results[0]).to.be.eq(ESTIMATOR_CATEGORY.AAVE_V2)
		expect(results[1]).to.be.eq(ESTIMATOR_CATEGORY.COMPOUND)
		expect(results[2]).to.be.eq(ITEM_CATEGORY.BASIC)
		expect(results[3]).to.be.eq(ITEM_CATEGORY.BASIC)
	})

	it('Should change estimator categories on a batch of tokens', async function () {
		const itemCategories = [ITEM_CATEGORY.BASIC, ITEM_CATEGORY.BASIC]
		const estimatorCategories = [ESTIMATOR_CATEGORY.COMPOUND, ESTIMATOR_CATEGORY.CURVE_GAUGE]
		const tokens = [this.tokens.aWETH, this.tokens.cUSDC]
		await this.factory.addItemsToRegistry(itemCategories, estimatorCategories, tokens)
		const results = await Promise.all([
			this.tokenRegistry.estimatorCategories(this.tokens.aWETH),
			this.tokenRegistry.estimatorCategories(this.tokens.cUSDC),
			this.tokenRegistry.itemCategories(this.tokens.aWETH),
			this.tokenRegistry.itemCategories(this.tokens.cUSDC),
		])
		expect(results[0]).to.be.eq(ESTIMATOR_CATEGORY.COMPOUND)
		expect(results[1]).to.be.eq(ESTIMATOR_CATEGORY.CURVE_GAUGE)
		expect(results[2]).to.be.eq(ITEM_CATEGORY.BASIC)
		expect(results[3]).to.be.eq(ITEM_CATEGORY.BASIC)
	})

	it("Should fail if array lengths don't match", async function () {
		let itemCategories = [ITEM_CATEGORY.BASIC, ITEM_CATEGORY.BASIC]
		let estimatorCategories = [ESTIMATOR_CATEGORY.AAVE_V2, ESTIMATOR_CATEGORY.COMPOUND]
		let tokens = [this.tokens.aWETH, this.tokens.cUSDC, this.tokens.dai]
		await expect(this.factory.addItemsToRegistry(itemCategories, estimatorCategories, tokens)).to.be.revertedWith(
			'Mismatched array lengths'
		)
		itemCategories = [ITEM_CATEGORY.BASIC, ITEM_CATEGORY.BASIC, ITEM_CATEGORY.BASIC]
		estimatorCategories = [ESTIMATOR_CATEGORY.AAVE_V2, ESTIMATOR_CATEGORY.COMPOUND]
		tokens = [this.tokens.aWETH, this.tokens.cUSDC]
		await expect(this.factory.addItemsToRegistry(itemCategories, estimatorCategories, tokens)).to.be.revertedWith(
			'Mismatched array lengths'
		)
	})
})
