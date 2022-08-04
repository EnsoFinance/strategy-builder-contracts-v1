import chai from 'chai'
const { expect } = chai
import { ethers, waffle, network } from 'hardhat'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { prepareStrategy, StrategyItem, InitialState, TradeData } from '../lib/encode'
import { Tokens } from '../lib/tokens'
import {
	Platform,
	deployCurveAdapter,
	deployCurveLPAdapter,
	deployCurveGaugeAdapter,
	deployUniswapV2Adapter,
	deployUniswapV3Adapter,
	deployCompoundAdapter,
	deployPlatform,
	deployLoopRouter,
} from '../lib/deploy'
import { MAINNET_ADDRESSES, ESTIMATOR_CATEGORY, ITEM_CATEGORY } from '../lib/constants'
//import { displayBalances } from '../lib/logging'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'
import UniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import { increaseTime } from '../lib/utils'

chai.use(solidity)

async function impersonate(address: string): Promise<SignerWithAddress> {
	await network.provider.request({
		method: 'hardhat_impersonateAccount',
		params: [address],
	})
	return await ethers.getSigner(address)
}

describe('CurveLPAdapter + CurveGaugeAdapter', function () {
	let platform: Platform,
		weth: Contract,
		crv: Contract,
		dai: Contract,
		accounts: SignerWithAddress[],
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		controllerLibrary: Contract,
		uniswapV2Adapter: Contract,
		uniswapV2Factory: Contract,
		uniswapV3Adapter: Contract,
		compoundAdapter: Contract,
		curveAdapter: Contract,
		curveLPAdapter: Contract,
		curveGaugeAdapter: Contract,
		crvLINKGauge: string,
		rewardsToken: Contract,
		stakingRewards: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		tokens: Tokens

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		crv = new Contract(tokens.crv, ERC20.abi, accounts[0])
		dai = new Contract(tokens.dai, ERC20.abi, accounts[0])
		//const usdt = new Contract(tokens.usdt, ERC20.abi, accounts[0])
		const comp = new Contract(tokens.COMP, ERC20.abi, accounts[0])
		uniswapV2Factory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, accounts[0])
		const uniswapV3Factory = new Contract(MAINNET_ADDRESSES.UNISWAP_V3_FACTORY, UniswapV3Factory.abi, accounts[0])
		const susd = new Contract(tokens.sUSD, ERC20.abi, accounts[0])
		platform = await deployPlatform(accounts[0], uniswapV2Factory, uniswapV3Factory, weth, susd)

		strategyFactory = platform.strategyFactory
		controller = platform.controller
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		controllerLibrary = platform.controllerLibrary

		const { tokenRegistry, curveDepositZapRegistry, chainlinkRegistry, uniswapV3Registry } =
			platform.oracles.registries

		await tokens.registerTokens(
			accounts[0],
			strategyFactory,
			uniswapV3Registry,
			chainlinkRegistry,
			curveDepositZapRegistry
		)

		const addressProvider = new Contract(MAINNET_ADDRESSES.CURVE_ADDRESS_PROVIDER, [], accounts[0])
		router = await deployLoopRouter(accounts[0], controller, platform.strategyLibrary)
		await whitelist.connect(accounts[0]).approve(router.address)
		uniswapV2Adapter = await deployUniswapV2Adapter(accounts[0], uniswapV2Factory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapV2Adapter.address)
		uniswapV3Adapter = await deployUniswapV3Adapter(
			accounts[0],
			uniswapV3Registry,
			new Contract(MAINNET_ADDRESSES.UNISWAP_V3_ROUTER, [], accounts[0]),
			weth
		)
		await whitelist.connect(accounts[0]).approve(uniswapV3Adapter.address)
		curveAdapter = await deployCurveAdapter(accounts[0], addressProvider, weth)
		await whitelist.connect(accounts[0]).approve(curveAdapter.address)
		curveLPAdapter = await deployCurveLPAdapter(accounts[0], addressProvider, curveDepositZapRegistry, weth)
		await whitelist.connect(accounts[0]).approve(curveLPAdapter.address)

		curveGaugeAdapter = await deployCurveGaugeAdapter(
			accounts[0],
			weth,
			tokenRegistry,
			ESTIMATOR_CATEGORY.CURVE_GAUGE
		)
		await whitelist.connect(accounts[0]).approve(curveGaugeAdapter.address)

		crvLINKGauge = tokens.crvLINKGauge

		// setting up rewards
		rewardsToken = await waffle.deployContract(accounts[0], ERC20, [WeiPerEther.mul(10000)])
		stakingRewards = await (
			await getContractFactory('StakingRewards')
		).deploy(accounts[0].address, accounts[0].address, rewardsToken.address, tokens.crvLINK) //, crvLINKGauge)
		const ownerBalance = await rewardsToken.balanceOf(accounts[0].address)

		await uniswapV2Factory.createPair(rewardsToken.address, weth.address)
		const pairAddress = await uniswapV2Factory.getPair(rewardsToken.address, weth.address)
		const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), accounts[0])
		await rewardsToken.connect(accounts[0]).transfer(pairAddress, ownerBalance.mul(2).div(3))
		await weth.connect(accounts[0]).deposit({ value: ownerBalance.div(3) })
		await weth.connect(accounts[0]).transfer(pairAddress, ownerBalance.div(3))
		await pair.connect(accounts[0]).mint(accounts[0].address)

		await rewardsToken.connect(accounts[0]).transfer(stakingRewards.address, ownerBalance.div(3))
		await stakingRewards.connect(accounts[0]).notifyRewardAmount(ownerBalance.div(3))
		let stakeSig = stakingRewards.interface.getSighash('stake')
		let withdrawSig = stakingRewards.interface.getSighash('withdraw')
		let claimSig = stakingRewards.interface.getSighash('getReward')
		let sigs =
			'0x' + stakeSig.substring(2) + withdrawSig.substring(2) + claimSig.substring(2) + AddressZero.substring(2)
		let rewardTokens = [rewardsToken.address]
		while (rewardTokens.length < 8) {
			rewardTokens.push(AddressZero)
		}
		const crvLINKGaugeContract = new Contract(
			crvLINKGauge,
			[
				{
					constant: false,
					inputs: [
						{
							internalType: 'address',
							name: '_rewardContract',
							type: 'address',
						},
						{
							internalType: 'bytes32',
							name: '_sigs',
							type: 'bytes32',
						},
						{
							internalType: 'address[8]',
							name: '_reward_tokens',
							type: 'address[8]',
						},
					],
					name: 'set_rewards',
					outputs: [],
					payable: false,
					stateMutability: 'nonpayable',
					type: 'function',
				},
				{
					constant: true,
					inputs: [],
					name: 'admin',
					outputs: [
						{
							internalType: 'address',
							name: '',
							type: 'address',
						},
					],
					payable: false,
					stateMutability: 'view',
					type: 'function',
				},
			],
			accounts[0]
		)
		const gaugeAdminProxy = new Contract(
			await crvLINKGaugeContract.admin(),
			[
				{
					constant: false,
					inputs: [
						{
							internalType: 'address',
							name: '_gauge',
							type: 'address',
						},
						{
							internalType: 'address',
							name: '_rewardContract',
							type: 'address',
						},
						{
							internalType: 'bytes32',
							name: '_sigs',
							type: 'bytes32',
						},
						{
							internalType: 'address[8]',
							name: '_reward_tokens',
							type: 'address[8]',
						},
					],
					name: 'set_rewards',
					outputs: [],
					payable: false,
					stateMutability: 'nonpayable',
					type: 'function',
				},
				{
					constant: true,
					inputs: [],
					name: 'ownership_admin',
					outputs: [
						{
							internalType: 'address',
							name: '',
							type: 'address',
						},
					],
					payable: false,
					stateMutability: 'view',
					type: 'function',
				},
			],
			accounts[0]
		)
		const ownershipAdminAddress = await gaugeAdminProxy.ownership_admin()
		await gaugeAdminProxy
			.connect(await impersonate(ownershipAdminAddress))
			['set_rewards'](crvLINKGaugeContract.address, stakingRewards.address, sigs, rewardTokens)

		// add rewards to registry
		let tradeData: TradeData = {
			adapters: [],
			path: [],
			cache: '0x',
		}

		compoundAdapter = await deployCompoundAdapter(
			accounts[0],
			new Contract(MAINNET_ADDRESSES.COMPOUND_COMPTROLLER, [], accounts[0]),
			weth,
			tokenRegistry,
			ESTIMATOR_CATEGORY.COMPOUND
		)
		await whitelist.connect(accounts[0]).approve(compoundAdapter.address)
		// add claimables
		await strategyFactory
			.connect(accounts[0])
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.CURVE_GAUGE,
				tokens.crvLINKGauge,
				tradeData,
				curveGaugeAdapter.address
			)
		await strategyFactory
			.connect(accounts[0])
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.COMPOUND,
				tokens.cUSDT,
				tradeData,
				compoundAdapter.address
			)
		await strategyFactory
			.connect(accounts[0])
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.COMPOUND,
				tokens.cDAI,
				tradeData,
				compoundAdapter.address
			)

		// add rewards tokens
		tradeData.adapters[0] = uniswapV2Adapter.address
		await strategyFactory
			.connect(accounts[0])
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.DEFAULT_ORACLE,
				comp.address,
				tradeData,
				AddressZero
			)
		tradeData.adapters = [uniswapV2Adapter.address]
		await strategyFactory
			.connect(accounts[0])
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.DEFAULT_ORACLE,
				rewardsToken.address,
				tradeData,
				AddressZero
			)
	})

	it('Should deploy "exotic" strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			// an "exotic" strategy
			{ token: dai.address, percentage: BigNumber.from(200) },
			{ token: crv.address, percentage: BigNumber.from(0) },
			{
				token: tokens.crvEURS,
				percentage: BigNumber.from(200),
				adapters: [uniswapV3Adapter.address, uniswapV3Adapter.address, curveLPAdapter.address],
				path: [tokens.usdc, tokens.eurs],
			},
			{
				token: tokens.crvLINKGauge,
				percentage: BigNumber.from(400),
				adapters: [uniswapV2Adapter.address, curveLPAdapter.address, curveGaugeAdapter.address],
				path: [tokens.link, tokens.crvLINK],
			},
			{
				token: tokens.cUSDT,
				percentage: BigNumber.from(100),
				adapters: [uniswapV2Adapter.address, compoundAdapter.address],
				path: [tokens.usdt],
			},
			{
				token: tokens.cDAI,
				percentage: BigNumber.from(100),
				adapters: [uniswapV2Adapter.address, compoundAdapter.address],
				path: [tokens.dai],
			},
		]
		strategyItems = prepareStrategy(positions, uniswapV2Adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(980), //Slippage is set low because of low-liquidity in EURS' UniV2 pool
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
				StrategyLibrary: platform.strategyLibrary.address,
				ControllerLibrary: controllerLibrary.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should set strategy and updateRewards', async function () {
		await expect(controller.connect(accounts[1]).setStrategy(strategy.address)).to.emit(controller, 'StrategySet')

		// setting up rewards
		rewardsToken = await waffle.deployContract(accounts[0], ERC20, [WeiPerEther.mul(10000)])

		stakingRewards = await (
			await getContractFactory('StakingRewards')
		).deploy(accounts[0].address, accounts[0].address, rewardsToken.address, tokens.crvLINK) //, crvLINKGauge)
		const ownerBalance = await rewardsToken.balanceOf(accounts[0].address)

		await uniswapV2Factory.createPair(rewardsToken.address, weth.address)
		const pairAddress = await uniswapV2Factory.getPair(rewardsToken.address, weth.address)
		const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), accounts[0])
		await rewardsToken.connect(accounts[0]).transfer(pairAddress, ownerBalance.mul(2).div(3))
		await weth.connect(accounts[0]).deposit({ value: ownerBalance.div(3) })
		await weth.connect(accounts[0]).transfer(pairAddress, ownerBalance.div(3))
		await pair.connect(accounts[0]).mint(accounts[0].address)

		await rewardsToken.connect(accounts[0]).transfer(stakingRewards.address, ownerBalance.div(3))

		await stakingRewards.connect(accounts[0]).notifyRewardAmount(ownerBalance.div(3))
		let stakeSig = stakingRewards.interface.getSighash('stake')
		let withdrawSig = stakingRewards.interface.getSighash('withdraw')
		let claimSig = stakingRewards.interface.getSighash('getReward')
		let sigs =
			'0x' + stakeSig.substring(2) + withdrawSig.substring(2) + claimSig.substring(2) + AddressZero.substring(2)
		let rewardTokens = [rewardsToken.address]
		while (rewardTokens.length < 8) {
			rewardTokens.push(AddressZero)
		}

		const crvLINKGaugeContract = new Contract(
			crvLINKGauge,
			[
				{
					constant: false,
					inputs: [
						{
							internalType: 'address',
							name: '_rewardContract',
							type: 'address',
						},
						{
							internalType: 'bytes32',
							name: '_sigs',
							type: 'bytes32',
						},
						{
							internalType: 'address[8]',
							name: '_reward_tokens',
							type: 'address[8]',
						},
					],
					name: 'set_rewards',
					outputs: [],
					payable: false,
					stateMutability: 'nonpayable',
					type: 'function',
				},
				{
					constant: true,
					inputs: [],
					name: 'admin',
					outputs: [
						{
							internalType: 'address',
							name: '',
							type: 'address',
						},
					],
					payable: false,
					stateMutability: 'view',
					type: 'function',
				},
			],
			accounts[0]
		)

		const gaugeAdminProxy = new Contract(
			await crvLINKGaugeContract.admin(),
			[
				{
					constant: false,
					inputs: [
						{
							internalType: 'address',
							name: '_gauge',
							type: 'address',
						},
						{
							internalType: 'address',
							name: '_rewardContract',
							type: 'address',
						},
						{
							internalType: 'bytes32',
							name: '_sigs',
							type: 'bytes32',
						},
						{
							internalType: 'address[8]',
							name: '_reward_tokens',
							type: 'address[8]',
						},
					],
					name: 'set_rewards',
					outputs: [],
					payable: false,
					stateMutability: 'nonpayable',
					type: 'function',
				},
				{
					constant: true,
					inputs: [],
					name: 'ownership_admin',
					outputs: [
						{
							internalType: 'address',
							name: '',
							type: 'address',
						},
					],
					payable: false,
					stateMutability: 'view',
					type: 'function',
				},
			],
			accounts[0]
		)

		const ownershipAdminAddress = await gaugeAdminProxy.ownership_admin()
		await gaugeAdminProxy
			.connect(await impersonate(ownershipAdminAddress))
			['set_rewards'](crvLINKGaugeContract.address, stakingRewards.address, sigs, rewardTokens)

		let tradeData: TradeData = {
			adapters: [],
			path: [],
			cache: '0x',
		}
		tradeData.adapters[0] = uniswapV2Adapter.address
		await strategyFactory
			.connect(accounts[0])
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.DEFAULT_ORACLE,
				rewardsToken.address,
				tradeData,
				AddressZero
			)

		const oldItems = await strategy.connect(accounts[1]).items()
		await strategy.connect(accounts[1]).updateRewards()
		const newItems = await strategy.connect(accounts[1]).items()
		const oldItemsLength = oldItems.length
		const newItemsLength = newItems.length

		expect(newItemsLength).to.be.gt(oldItemsLength)
		expect(oldItems.indexOf(rewardsToken.address)).to.be.equal(-1)
		expect(newItems.indexOf(rewardsToken.address)).to.be.gt(-1)
	})

	it('Should deploy "exotic" strategy', async function () {
		const name = 'Test Strategy2'
		const symbol = 'TEST2'
		const positions = [
			// an "exotic" strategy
			{ token: dai.address, percentage: BigNumber.from(200) },
			{ token: crv.address, percentage: BigNumber.from(0) },
			{
				token: tokens.crvEURS,
				percentage: BigNumber.from(200),
				adapters: [uniswapV3Adapter.address, uniswapV3Adapter.address, curveLPAdapter.address],
				path: [tokens.usdc, tokens.eurs],
			},
			{
				token: tokens.crvLINKGauge,
				percentage: BigNumber.from(400),
				adapters: [uniswapV2Adapter.address, curveLPAdapter.address, curveGaugeAdapter.address],
				path: [tokens.link, tokens.crvLINK],
			},
			{
				token: tokens.cUSDT,
				percentage: BigNumber.from(100),
				adapters: [uniswapV2Adapter.address, compoundAdapter.address],
				path: [tokens.usdt],
			},
			{
				token: tokens.cDAI,
				percentage: BigNumber.from(100),
				adapters: [uniswapV2Adapter.address, compoundAdapter.address],
				path: [tokens.dai],
			},
		]
		strategyItems = prepareStrategy(positions, uniswapV2Adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(990),
			restructureSlippage: BigNumber.from(980), //Slippage is set low because of low-liquidity in EURS' UniV2 pool
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
				StrategyLibrary: platform.strategyLibrary.address,
				ControllerLibrary: controllerLibrary.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(800)
		await weth.connect(accounts[19]).deposit({ value: value })
		await weth.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, dai.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deposit more: ETH', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[1].address)
		//console.log(DEFAULT_DEPOSIT_SLIPPAGE)
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, router.address, 0, BigNumber.from(980), '0x', {
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
		const rewardsTokens = await strategy.callStatic.getAllRewardTokens()
		const rewardsTokensLength = rewardsTokens.length
		expect(rewardsTokensLength).to.be.gt(0)
		let balancesBefore = []
		for (let i = 0; i < rewardsTokens.length; ++i) {
			const rewardsToken = new Contract(rewardsTokens[i], ERC20.abi, accounts[0])
			const balanceBefore = await rewardsToken.balanceOf(strategy.address)
			balancesBefore.push(balanceBefore)
		}
		await increaseTime(3 * 60) // 3 hrs
		const tx = await strategy.connect(accounts[1]).claimAll()
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		for (let i = 0; i < rewardsTokens.length; ++i) {
			const balanceAfter = await rewardsToken.balanceOf(strategy.address)
			expect(balanceAfter).to.be.gt(balancesBefore[i])
		}
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = await dai.balanceOf(accounts[19].address)
		await dai.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, dai.address, weth.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deploy strategy with ETH + BTC', async function () {
		const name = 'Curve ETHBTC Strategy'
		const symbol = 'ETHBTC'
		const positions = [
			{ token: dai.address, percentage: BigNumber.from(400) },
			{
				token: tokens.crvREN,
				percentage: BigNumber.from(400),
				adapters: [uniswapV2Adapter.address, curveLPAdapter.address],
				path: [tokens.wbtc],
			},
			{
				token: tokens.crvSETH,
				percentage: BigNumber.from(200),
				adapters: [uniswapV2Adapter.address, curveLPAdapter.address],
				path: [tokens.sETH],
			},
		]
		strategyItems = prepareStrategy(positions, uniswapV2Adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(980), // Needs to tolerate more slippage
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
				StrategyLibrary: platform.strategyLibrary.address,
				ControllerLibrary: controllerLibrary.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(800)
		await weth.connect(accounts[19]).deposit({ value: value })
		await weth.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, dai.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = await dai.balanceOf(accounts[19].address)
		await dai.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, dai.address, weth.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deploy strategy with Curve metapool', async function () {
		const name = 'Curve MetaPool Strategy'
		const symbol = 'META'
		const positions = [
			{ token: dai.address, percentage: BigNumber.from(500) },
			{
				token: tokens.crvUSDN, //Metapool uses 3crv as a liquidity token
				percentage: BigNumber.from(500),
				adapters: [uniswapV2Adapter.address, curveLPAdapter.address, curveLPAdapter.address],
				path: [tokens.usdc, tokens.crv3],
			},
		]
		strategyItems = prepareStrategy(positions, uniswapV2Adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(980),
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
				StrategyLibrary: platform.strategyLibrary.address,
				ControllerLibrary: controllerLibrary.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(1000)
		await weth.connect(accounts[19]).deposit({ value: value })
		await weth.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, dai.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = await dai.balanceOf(accounts[19].address)
		await dai.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, dai.address, weth.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})
})
