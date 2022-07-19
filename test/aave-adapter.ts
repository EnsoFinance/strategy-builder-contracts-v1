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
import { isRevertedWith } from '../lib/errors'
import {
	Platform,
	deployAaveV2Adapter,
	deployAaveV2DebtAdapter,
	deployUniswapV2Adapter,
	deployMetaStrategyAdapter,
	deploySynthetixAdapter,
	deployCurveAdapter,
	deployPlatform,
	deployFullRouter,
} from '../lib/deploy'
import { MAINNET_ADDRESSES, ESTIMATOR_CATEGORY, ITEM_CATEGORY } from '../lib/constants'
//import { displayBalances } from '../lib/logging'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'

chai.use(solidity)

const STRATEGY_STATE: InitialState = {
	timelock: BigNumber.from(60),
	rebalanceThreshold: BigNumber.from(10),
	rebalanceSlippage: BigNumber.from(997),
	restructureSlippage: BigNumber.from(995),
	managementFee: BigNumber.from(0),
	social: true,
	set: false,
}

describe('AaveAdapter', function () {
	let platform: Platform,
		weth: Contract,
		susd: Contract,
		usdc: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		library: Contract,
		whitelist: Contract,
		uniswapAdapter: Contract,
		aaveV2Adapter: Contract,
		aaveV2DebtAdapter: Contract,
		synthetixAdapter: Contract,
		curveAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		tokens: Tokens,
		collateralToken: string,
		collateralToken2: string,
		stkAAVE: Contract

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		susd = new Contract(tokens.sUSD, ERC20.abi, accounts[0])
		usdc = new Contract(tokens.usdc, ERC20.abi, accounts[0])
		stkAAVE = new Contract('0x4da27a545c0c5B758a6BA100e3a049001de870f5', ERC20.abi, accounts[0])

		uniswapFactory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, accounts[0])
		platform = await deployPlatform(
			accounts[0],
			uniswapFactory,
			new Contract(AddressZero, [], accounts[0]),
			weth,
			susd
		)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		library = platform.library
		whitelist = platform.administration.whitelist
		const aaveAddressProvider = new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], accounts[0])
		const synthetixAddressProvider = new Contract(MAINNET_ADDRESSES.SYNTHETIX_ADDRESS_PROVIDER, [], accounts[0])
		const curveAddressProvider = new Contract(MAINNET_ADDRESSES.CURVE_ADDRESS_PROVIDER, [], accounts[0])

		const { tokenRegistry, curveDepositZapRegistry, chainlinkRegistry } = platform.oracles.registries
		await tokens.registerTokens(accounts[0], strategyFactory, undefined, chainlinkRegistry, curveDepositZapRegistry)
		collateralToken = tokens.aWETH
		collateralToken2 = tokens.aCRV

		router = await deployFullRouter(accounts[0], aaveAddressProvider, controller, library)
		await whitelist.connect(accounts[0]).approve(router.address)
		uniswapAdapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapAdapter.address)
		aaveV2Adapter = await deployAaveV2Adapter(
			accounts[0],
			aaveAddressProvider,
			controller,
			weth,
			tokenRegistry,
			ESTIMATOR_CATEGORY.AAVE_V2
		)
		await whitelist.connect(accounts[0]).approve(aaveV2Adapter.address)
		aaveV2DebtAdapter = await deployAaveV2DebtAdapter(accounts[0], aaveAddressProvider, weth)
		await whitelist.connect(accounts[0]).approve(aaveV2DebtAdapter.address)
		synthetixAdapter = await deploySynthetixAdapter(accounts[0], synthetixAddressProvider, weth)
		await whitelist.connect(accounts[0]).approve(synthetixAdapter.address)
		curveAdapter = await deployCurveAdapter(accounts[0], curveAddressProvider, weth)
		await whitelist.connect(accounts[0]).approve(curveAdapter.address)

		let tradeData: TradeData = {
			adapters: [],
			path: [],
			cache: '0x',
		}
		await strategyFactory
			.connect(accounts[0])
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.AAVE_V2,
				collateralToken,
				tradeData,
				true
			)
		await strategyFactory
			.connect(accounts[0])
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.AAVE_V2,
				collateralToken2,
				tradeData,
				true
			)

		tradeData.adapters.push(uniswapAdapter.address)
		await strategyFactory
			.connect(accounts[0])
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.DEFAULT_ORACLE,
				stkAAVE.address,
				tradeData,
				false
			)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'

		const positions = [
			{
				token: collateralToken,
				percentage: BigNumber.from(1000),
				adapters: [aaveV2Adapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(
					['uint16'],
					[500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
				),
			},
			{
				token: collateralToken2,
				percentage: BigNumber.from(1000),
				adapters: [uniswapAdapter.address, aaveV2Adapter.address],
				path: [tokens.crv],
				cache: ethers.utils.defaultAbiCoder.encode(
					['uint16'],
					[500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
				),
			},
			{
				token: tokens.debtUSDC,
				percentage: BigNumber.from(-1000),
				adapters: [aaveV2DebtAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, tokens.weth], //ending in weth allows for a leverage feedback loop
				cache: ethers.utils.defaultAbiCoder.encode(
					['tuple(address token, uint16 percentage)[]'],
					[
						[
							{ token: collateralToken, percentage: 500 },
							{ token: collateralToken2, percentage: 500 },
						],
					] //define what tokens you want to loop back on here
				),
			},
		]

		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(980), // Restucturing from this strategy requires higher slippage tolerance
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}

		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	/*it('Should getAllRewardTokens', async function () {
		const rewardTokens = await strategy.connect(accounts[1]).callStatic.getAllRewardTokens()
    expect(rewardTokens[0]).to.be.equal(stkAAVE.address)
	})*/

	it('Should deposit', async function () {
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, router.address, 0, '990', '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(1000)
		await weth.connect(accounts[19]).deposit({ value: value })
		await weth.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, usdc.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller
			.connect(accounts[1])
			.rebalance(strategy.address, router.address, '0x', { gasLimit: '5000000' })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = await usdc.balanceOf(accounts[19].address)
		await usdc.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, usdc.address, weth.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller
			.connect(accounts[1])
			.rebalance(strategy.address, router.address, '0x', { gasLimit: '5000000' })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to withdrawAll: cannot withdraw debt', async function () {
		const amount = BigNumber.from('10000000000000000')
		expect(
			await isRevertedWith(
				strategy.connect(accounts[1]).withdrawAll(amount),
				'Cannot withdraw debt',
				'Strategy.sol'
			)
		).to.be.true
	})

	it('Should restructure', async function () {
		const positions = [
			{
				token: collateralToken,
				percentage: BigNumber.from(2000),
				adapters: [aaveV2Adapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(
					['uint16'],
					[500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
				),
			},
			{
				token: tokens.debtUSDC,
				percentage: BigNumber.from(-1000),
				adapters: [aaveV2DebtAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, tokens.weth],
				cache: ethers.utils.defaultAbiCoder.encode(
					['tuple(address token, uint16 percentage)[]'],
					[
						[
							{ token: collateralToken, percentage: 500 },
							{ token: collateralToken2, percentage: 0 },
						],
					] //Need to keep collateralToken2 in the cache in order to deleverage it
				),
			},
		]
		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		await controller.connect(accounts[1]).restructure(strategy.address, strategyItems)
	})

	it('Should finalize structure', async function () {
		const tx = await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, router.address, '0x', { gasLimit: '5000000' })
		const receipt = await tx.wait()
		console.log('Finalize Structure Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should deposit', async function () {
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, router.address, 0, '990', '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should withdraw ETH', async function () {
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const amount = BigNumber.from('5000000000000000')
		const ethBalanceBefore = await accounts[1].getBalance()
		const tx = await controller
			.connect(accounts[1])
			.withdrawETH(strategy.address, router.address, amount, '985', '0x', { gasLimit: '5000000' })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const ethBalanceAfter = await accounts[1].getBalance()
		expect(ethBalanceAfter.gt(ethBalanceBefore)).to.equal(true)
	})

	it('Should withdraw WETH', async function () {
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const amount = BigNumber.from('5000000000000000')
		const wethBalanceBefore = await weth.balanceOf(accounts[1].address)
		const tx = await controller
			.connect(accounts[1])
			.withdrawWETH(strategy.address, router.address, amount, '985', '0x', { gasLimit: '5000000' })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const wethBalanceAfter = await weth.balanceOf(accounts[1].address)
		expect(wethBalanceAfter.gt(wethBalanceBefore)).to.equal(true)
	})

	it('Should claim stkAAVE', async function () {
		const balanceBefore = await stkAAVE.balanceOf(strategy.address)
		const tx = await strategy.connect(accounts[1]).claimAll()
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await stkAAVE.balanceOf(strategy.address)
		expect(balanceAfter).to.be.gt(balanceBefore)
	})

	it('Should deploy new strategy', async function () {
		const name = 'New Strategy'
		const symbol = 'NEW'

		const positions = [
			{
				token: tokens.aWETH,
				percentage: BigNumber.from(2000),
				adapters: [aaveV2Adapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(
					['uint16'],
					[500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
				),
			},
			{
				token: tokens.debtUSDC,
				percentage: BigNumber.from(-1000),
				adapters: [aaveV2DebtAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, tokens.weth],
				cache: ethers.utils.defaultAbiCoder.encode(
					['tuple(address token, uint16 percentage)[]'],
					[[{ token: collateralToken, percentage: 500 }]] //define what tokens you want to loop back on here
				),
			},
		]

		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(980), // Restucturing from this strategy requires higher slippage tolerance
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}

		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deposit', async function () {
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, router.address, 0, '990', '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should deploy another strategy', async function () {
		const name = 'Another Strategy'
		const symbol = 'ANOTHER'

		const positions = [
			{
				token: tokens.aWETH,
				percentage: BigNumber.from(2000),
				adapters: [aaveV2Adapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(
					['uint16'],
					[500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
				),
			},
			{
				token: tokens.debtUSDC,
				percentage: BigNumber.from(-500),
				adapters: [aaveV2DebtAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, tokens.weth],
				cache: ethers.utils.defaultAbiCoder.encode(
					['tuple(address token, uint16 percentage)[]'],
					[[{ token: collateralToken, percentage: 250 }]] //define what tokens you want to loop back on here),
				),
			},
			{
				token: tokens.debtWBTC,
				percentage: BigNumber.from(-500),
				adapters: [aaveV2DebtAdapter.address, uniswapAdapter.address],
				path: [tokens.wbtc, tokens.weth],
				cache: ethers.utils.defaultAbiCoder.encode(
					['tuple(address token, uint16 percentage)[]'],
					[[{ token: collateralToken, percentage: 250 }]] //define what tokens you want to loop back on here),
				),
			},
		]

		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(980), // Restucturing from this strategy requires higher slippage tolerance
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}

		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deposit', async function () {
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, router.address, 0, '990', '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should deploy ambiguous strategy', async function () {
		const name = 'Ambiguous Strategy'
		const symbol = 'AMBI'

		const positions = [
			{
				token: collateralToken,
				percentage: BigNumber.from(500),
				adapters: [aaveV2Adapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(['uint16'], [500]),
			},
			{
				token: collateralToken2,
				percentage: BigNumber.from(1500),
				adapters: [uniswapAdapter.address, aaveV2Adapter.address],
				path: [tokens.crv],
				cache: ethers.utils.defaultAbiCoder.encode(['uint16'], [500]),
			},
			{
				token: tokens.debtUSDC,
				percentage: BigNumber.from(-875),
				adapters: [aaveV2DebtAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, tokens.weth],
				cache: ethers.utils.defaultAbiCoder.encode(
					['tuple(address token, uint16 percentage)[]'],
					[
						[
							{ token: collateralToken, percentage: 250 },
							{ token: collateralToken2, percentage: 500 },
						],
					] //define what tokens you want to loop back on here
				),
			},
			{
				token: tokens.debtWBTC,
				percentage: BigNumber.from(-125),
				adapters: [aaveV2DebtAdapter.address, uniswapAdapter.address],
				path: [tokens.wbtc, tokens.weth],
				cache: ethers.utils.defaultAbiCoder.encode(
					['tuple(address token, uint16 percentage)[]'],
					[[{ token: collateralToken, percentage: 250 }]] //define what tokens you want to loop back on here
				),
			},
		]

		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(980), // Restucturing from this strategy requires higher slippage tolerance
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}

		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()

		strategy = await Strategy.attach(strategyAddress)
		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deposit', async function () {
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, router.address, 0, '990', '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should deploy debt meta strategy', async function () {
		//await displayBalances(basicWrapper, basicStrategyItems.map((item) => item.item), weth)

		let name = 'Basic Strategy'
		let symbol = 'BASIC'
		let positions = [
			{ token: weth.address, percentage: BigNumber.from(500) },
			{ token: usdc.address, percentage: BigNumber.from(500) },
		]
		const basicStrategyItems = prepareStrategy(positions, uniswapAdapter.address)

		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, basicStrategyItems, STRATEGY_STATE, router.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})

		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		let strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()
		const basicStrategy = await Strategy.attach(strategyAddress)

		let metaStrategyAdapter = await deployMetaStrategyAdapter(accounts[0], controller, router, weth)
		await whitelist.connect(accounts[0]).approve(metaStrategyAdapter.address)

		name = 'Debt Meta Strategy'
		symbol = 'DMETA'
		let positions2 = [
			{
				token: basicStrategy.address,
				percentage: BigNumber.from(400),
				adapters: [metaStrategyAdapter.address],
				path: [],
			},
			{
				token: tokens.aWETH,
				percentage: BigNumber.from(1200),
				adapters: [aaveV2Adapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(
					['uint16'],
					[500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
				),
			},
			{
				token: tokens.debtUSDC,
				percentage: BigNumber.from(-600),
				adapters: [aaveV2DebtAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, weth.address], //ending in weth allows for a leverage feedback loop
				cache: ethers.utils.defaultAbiCoder.encode(
					['tuple(address token, uint16 percentage)[]'],
					[[{ token: tokens.aWETH, percentage: 500 }]]
				),
			},
		]

		let metaStrategyItems = prepareStrategy(positions2, uniswapAdapter.address)
		tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, metaStrategyItems, STRATEGY_STATE, router.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address,
			},
		})
		let metaWrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await metaWrapper.deployed()

		//await displayBalances(basicWrapper, basicStrategyItems.map((item) => item.item), weth)
		expect(await metaWrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to deploy synth + debt strategy', async function () {
		const name = 'SynthDebt Strategy'
		const symbol = 'SD'

		const positions = [
			{
				token: tokens.sUSD,
				percentage: BigNumber.from(0),
				adapters: [uniswapAdapter.address, curveAdapter.address],
				path: [tokens.usdc],
				cache: '0x',
			},
			{
				token: tokens.sAAVE,
				percentage: BigNumber.from(500),
				adapters: [synthetixAdapter.address],
				path: [],
				cache: '0x',
			},
			{
				token: tokens.aWETH,
				percentage: BigNumber.from(1000),
				adapters: [aaveV2Adapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(
					['uint16'],
					[500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
				),
			},
			{
				token: tokens.debtUSDC,
				percentage: BigNumber.from(-500),
				adapters: [aaveV2DebtAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, tokens.weth],
				cache: ethers.utils.defaultAbiCoder.encode(
					['tuple(address token, uint16 percentage)[]'],
					[[{ token: tokens.aWETH, percentage: 500 }]] //define what tokens you want to loop back on here),
				),
			},
		]

		const failItems = prepareStrategy(positions, uniswapAdapter.address)

		expect(
			await isRevertedWith(
				strategyFactory
					.connect(accounts[1])
					.createStrategy(name, symbol, failItems, STRATEGY_STATE, router.address, '0x', {
						value: WeiPerEther,
					}),
				'No synths and debt',
				'StrategyController.sol'
			)
		).to.be.true
	})
})
