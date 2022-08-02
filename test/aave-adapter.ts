import chai from 'chai'
import hre from 'hardhat'
const { expect } = chai
import { ethers } from 'hardhat'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { prepareStrategy, encodeTransferFrom, StrategyItem, InitialState, TradeData } from '../lib/encode'
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
	deployMulticallRouter,
} from '../lib/deploy'
import { MAINNET_ADDRESSES, ESTIMATOR_CATEGORY, ITEM_CATEGORY } from '../lib/constants'
//import { displayBalances } from '../lib/logging'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import { increaseTime } from '../lib/utils'

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
		fullRouter: Contract,
		multicallRouter: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		controllerLibrary: Contract,
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

	before('Resetting network', async function () {
		const _config: any = hre.network.config
		await hre.network.provider.request({
			method: 'hardhat_reset',
			params: [
				{
					forking: {
						jsonRpcUrl: _config.forking.url,
						blockNuber: _config.forking.blockNumber,
					},
				},
			],
		})
	})

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
		controllerLibrary = platform.controllerLibrary
		whitelist = platform.administration.whitelist
		const aaveAddressProvider = new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], accounts[0])
		const synthetixAddressProvider = new Contract(MAINNET_ADDRESSES.SYNTHETIX_ADDRESS_PROVIDER, [], accounts[0])
		const curveAddressProvider = new Contract(MAINNET_ADDRESSES.CURVE_ADDRESS_PROVIDER, [], accounts[0])

		const { tokenRegistry, curveDepositZapRegistry, chainlinkRegistry } = platform.oracles.registries
		await tokens.registerTokens(accounts[0], strategyFactory, undefined, chainlinkRegistry, curveDepositZapRegistry)
		collateralToken = tokens.aWETH
		collateralToken2 = tokens.aCRV

		uniswapAdapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapAdapter.address)

		fullRouter = await deployFullRouter(accounts[0], aaveAddressProvider, controller, platform.strategyLibrary)
		await whitelist.connect(accounts[0]).approve(fullRouter.address)
		multicallRouter = await deployMulticallRouter(accounts[0], controller)
		await whitelist.connect(accounts[0]).approve(multicallRouter.address)

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
				percentage: BigNumber.from(600),
				adapters: [aaveV2Adapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(
					['uint16'],
					[833] // Multiplier 83.3% (divisor = 1000). For calculating the amount to purchase based off of the percentage
				),
			},
			{
				token: collateralToken2,
				percentage: BigNumber.from(600),
				adapters: [uniswapAdapter.address, aaveV2Adapter.address],
				path: [tokens.crv],
				cache: ethers.utils.defaultAbiCoder.encode(
					['uint16'],
					[833] // Multiplier 83.3% (divisor = 1000). For calculating the amount to purchase based off of the percentage
				),
			},
			{
				token: tokens.debtUSDC,
				percentage: BigNumber.from(-200),
				adapters: [aaveV2DebtAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, tokens.weth], //ending in weth allows for a leverage feedback loop
				cache: ethers.utils.defaultAbiCoder.encode(
					['tuple(address token, uint16 percentage)[]'],
					[
						[
							{ token: collateralToken, percentage: 167 },
							{ token: collateralToken2, percentage: 167 },
						],
					] //define what tokens you want to loop back on here
				),
			},
		]

		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(990),
			restructureSlippage: BigNumber.from(980), // Restucturing from this strategy requires higher slippage tolerance
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}

		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, fullRouter.address, '0x', {
				value: WeiPerEther,
			})
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: platform.strategyLibrary.address,
				ControllerLibrary: controllerLibrary.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should getAllRewardTokens', async function () {
		const rewardTokens = await strategy.connect(accounts[1]).callStatic.getAllRewardTokens()
		expect(rewardTokens[0]).to.be.equal(stkAAVE.address)
	})

	it('Should deposit', async function () {
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, fullRouter.address, 0, '990', '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// simulates a large sway in the market over some period
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(5000)
		await weth.connect(accounts[19]).deposit({ value: value })
		await weth.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, usdc.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller
			.connect(accounts[1])
			.rebalance(strategy.address, fullRouter.address, '0x', { gasLimit: '5000000' })
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

	it('Should claim stkAAVE', async function () {
		const balanceBefore = await stkAAVE.balanceOf(strategy.address)
		const tx = await strategy.connect(accounts[1]).claimAll()
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await stkAAVE.balanceOf(strategy.address)
		expect(balanceAfter).to.be.gt(balanceBefore)
	})

	it('Should rebalance strategy', async function () {
		// the strategy has a balance of stkAAVE within its "claimables"
		// meaning that the percentage of which should be 0% in the strategy
		// so during this rebalance, this stkAAVE is just sold on uniswap for WETH.
		// If later, we register stkAAVE itself as a "claimable", the strategy
		// could maintain a balance in stkAAVE from which it would claim rewards in AAVE
		await increaseTime(5 * 60 + 1)
		const tx = await controller
			.connect(accounts[1])
			.rebalance(strategy.address, fullRouter.address, '0x', { gasLimit: '5000000' })
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

	it('Should deposit', async function () {
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, fullRouter.address, 0, '990', '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should withdraw ETH', async function () {
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const amount = BigNumber.from('5000000000000000')
		const ethBalanceBefore = await accounts[1].getBalance()
		const tx = await controller.connect(accounts[1]).withdrawETH(
			strategy.address,
			fullRouter.address,
			amount,
			'977', // note the high slippage!
			'0x',
			{ gasLimit: '5000000' }
		)
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
		const tx = await controller.connect(accounts[1]).withdrawWETH(
			strategy.address,
			fullRouter.address,
			amount,
			'960', // note the high slippage!
			'0x',
			{ gasLimit: '5000000' }
		)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const wethBalanceAfter = await weth.balanceOf(accounts[1].address)
		expect(wethBalanceAfter.gt(wethBalanceBefore)).to.equal(true)
	})

	it('Should restructure - basic', async function () {
		const positions = [{ token: tokens.usdt, percentage: BigNumber.from(1000), adapters: [uniswapAdapter.address] }]
		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		await controller.connect(accounts[1]).restructure(strategy.address, strategyItems)
	})

	it('Should fail to finalize structure - debt oracle exploit', async function () {
		const collateral = new Contract(collateralToken, ERC20.abi, accounts[0])
		const collateral2 = new Contract(collateralToken2, ERC20.abi, accounts[0])
		const collateralBalance = await collateral.balanceOf(strategy.address)
		const collateral2Balance = await collateral2.balanceOf(strategy.address)
		const calls = [
			encodeTransferFrom(collateral, strategy.address, accounts[1].address, collateralBalance.div(6)),
			encodeTransferFrom(collateral2, strategy.address, accounts[1].address, collateral2Balance.div(6)),
		]
		const data = await multicallRouter.encodeCalls(calls)
		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, multicallRouter.address, data, { gasLimit: '5000000' })
		).to.be.revertedWith('Former debt remaining')
	})

	it('Should finalize structure - basic', async function () {
		const tx = await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, fullRouter.address, '0x', { gasLimit: '5000000' })
		const receipt = await tx.wait()
		console.log('Finalize Structure Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should restructure - debt positions', async function () {
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
		await controller.connect(accounts[1]).restructure(strategy.address, strategyItems)
	})

	it('Should finalize structure - debt positions', async function () {
		const tx = await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, fullRouter.address, '0x', { gasLimit: '5000000' })
		const receipt = await tx.wait()
		console.log('Finalize Structure Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should deposit', async function () {
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, fullRouter.address, 0, '990', '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should withdraw ETH', async function () {
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const amount = BigNumber.from('5000000000000000')
		const ethBalanceBefore = await accounts[1].getBalance()
		// note the high slippage!
		const tx = await controller
			.connect(accounts[1])
			.withdrawETH(strategy.address, fullRouter.address, amount, '970', '0x', { gasLimit: '5000000' })
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
		// note the high slippage!
		const tx = await controller
			.connect(accounts[1])
			.withdrawWETH(strategy.address, fullRouter.address, amount, '960', '0x', { gasLimit: '5000000' })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const wethBalanceAfter = await weth.balanceOf(accounts[1].address)
		expect(wethBalanceAfter.gt(wethBalanceBefore)).to.equal(true)
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
			restructureSlippage: BigNumber.from(995), // Restucturing from this strategy requires higher slippage tolerance
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}

		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, fullRouter.address, '0x', {
				value: WeiPerEther,
			})
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: platform.strategyLibrary.address,
				ControllerLibrary: controllerLibrary.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deposit', async function () {
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, fullRouter.address, 0, '990', '0x', { value: WeiPerEther })
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
			.createStrategy(name, symbol, strategyItems, strategyState, fullRouter.address, '0x', {
				value: WeiPerEther,
			})
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: platform.strategyLibrary.address,
				ControllerLibrary: controllerLibrary.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deposit', async function () {
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, fullRouter.address, 0, '990', '0x', { value: WeiPerEther })
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
			.createStrategy(name, symbol, strategyItems, strategyState, fullRouter.address, '0x', {
				value: WeiPerEther,
			})
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()

		strategy = await Strategy.attach(strategyAddress)
		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: platform.strategyLibrary.address,
				ControllerLibrary: controllerLibrary.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deposit', async function () {
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, fullRouter.address, 0, '990', '0x', { value: WeiPerEther })
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
			.createStrategy(name, symbol, basicStrategyItems, STRATEGY_STATE, fullRouter.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})

		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		let strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()
		const basicStrategy = await Strategy.attach(strategyAddress)

		let metaStrategyAdapter = await deployMetaStrategyAdapter(accounts[0], controller, fullRouter, weth)
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
			.createStrategy(name, symbol, metaStrategyItems, STRATEGY_STATE, fullRouter.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: platform.strategyLibrary.address,
				ControllerLibrary: controllerLibrary.address,
			},
		})
		let metaWrapper = await LibraryWrapper.connect(accounts[0]).deploy(
			oracle.address,
			strategyAddress,
			controller.address
		)
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
					.createStrategy(name, symbol, failItems, STRATEGY_STATE, fullRouter.address, '0x', {
						value: WeiPerEther,
					}),
				'No synths and debt',
				'StrategyController.sol'
			)
		).to.be.true
	})
})
