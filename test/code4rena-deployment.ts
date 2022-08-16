import hre from 'hardhat'
import chai from 'chai'
const { expect } = chai
import { BigNumber, Contract, Event } from 'ethers'
//import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { solidity } from 'ethereum-waffle'
const { ethers, waffle } = hre
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
import { deployCode4renaFixes } from '../scripts/code-4rena-deploy'
import { transferOwnershipTokenRegistry } from '../scripts/transferownership-tokenregistry'
//import { registerTokens } from '../scripts/register-token'
import { Tokens } from '../lib/tokens'
import { prepareStrategy, StrategyItem, InitialState, TradeData } from '../lib/encode'
import { MAINNET_ADDRESSES, ESTIMATOR_CATEGORY, ITEM_CATEGORY } from '../lib/constants'
import { increaseTime, impersonate } from '../lib/utils'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'

import { initializeTestLogging, logTestComplete } from '../lib/convincer'

chai.use(solidity)
describe('Code4rena deployment', function () {
	let proofCounter: number,
		contracts: { [key: string]: string },
		tokens: Tokens,
		weth: Contract,
		/*	crv: Contract,
		 */
		dai: Contract,
		accounts: SignerWithAddress[],
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		/*
		whitelist: Contract,
		controllerLibrary: Contract,
    */
		uniswapV2Factory: Contract,
		uniswapV2Adapter: Contract,
		uniswapV3Adapter: Contract,
		compoundAdapter: Contract,
		//curveAdapter: Contract,
		curveLPAdapter: Contract,
		curveGaugeAdapter: Contract,
		crvLINKGauge: string,
		rewardsToken: Contract,
		stakingRewards: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract

	before('Deploy new contracts.', async function () {
		proofCounter = initializeTestLogging(this, __dirname)

		accounts = await getSigners()
		uniswapV2Factory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, accounts[0])
	})

	it('Should deployCode4renaFixes', async function () {
		contracts = await deployCode4renaFixes()
		console.log(contracts)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should transferOwnershipTokenRegistry', async function () {
		await transferOwnershipTokenRegistry()
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should registerTokens', async function () {
		tokens = new Tokens() // FIXME delete after registerTokens() is fixed
		/*tokens = await registerTokens()
    console.log(tokens)
		logTestComplete(this, __dirname, proofCounter++)
    */
	})

	// TODO mimic live-estimates

	// deploy exotic strategy etc
	it('Should deploy "exotic" strategy', async function () {
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		controller = new Contract(
			contracts['StrategyController'],
			(
				await getContractFactory('StrategyController', {
					libraries: {
						ControllerLibrary: contracts['ControllerLibrary'],
					},
				})
			).interface,
			accounts[0]
		)
		oracle = new Contract(contracts['EnsoOracle'], (await getContractFactory('EnsoOracle')).interface, accounts[0])
		strategyFactory = new Contract(
			contracts['StrategyProxyFactory'],
			(await getContractFactory('StrategyProxyFactory')).interface,
			accounts[0]
		)

		router = new Contract(
			contracts['LoopRouter'],
			(
				await getContractFactory('LoopRouter', {
					libraries: {
						StrategyLibrary: contracts['StrategyLibrary'],
					},
				})
			).interface,
			accounts[0]
		)

		uniswapV2Adapter = new Contract(
			contracts['UniswapV2Adapter'],
			(await getContractFactory('UniswapV2Adapter')).interface,
			accounts[0]
		)
		uniswapV3Adapter = new Contract(
			contracts['UniswapV3Adapter'],
			(await getContractFactory('UniswapV3Adapter')).interface,
			accounts[0]
		)
		compoundAdapter = new Contract(
			contracts['CompoundAdapter'],
			(await getContractFactory('CompoundAdapter')).interface,
			accounts[0]
		)
		curveLPAdapter = new Contract(
			contracts['CurveLPAdapter'],
			(await getContractFactory('CurveLPAdapter')).interface,
			accounts[0]
		)
		curveGaugeAdapter = new Contract(
			contracts['CurveGaugeAdapter'],
			(await getContractFactory('CurveGaugeAdapter')).interface,
			accounts[0]
		)

		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			// an "exotic" strategy
			{ token: tokens.dai, percentage: BigNumber.from(200) },
			{ token: tokens.crv, percentage: BigNumber.from(0) },
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
		console.log('debug before')
		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		console.log('debug after')
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy

		const Strategy = await hre.ethers.getContractFactory('Strategy', {
			libraries: {
				StrategyClaim: contracts['StrategyClaim'],
			},
		})

		strategy = await Strategy.attach(strategyAddress)
		strategy = strategy // debug

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: contracts['StrategyLibrary'],
				ControllerLibrary: contracts['ControllerLibrary'],
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should set strategy and updateRewards', async function () {
		await expect(controller.connect(accounts[1]).setStrategy(strategy.address)).to.emit(controller, 'StrategySet')

		// setting up rewards
		rewardsToken = await waffle.deployContract(accounts[0], ERC20, [WeiPerEther.mul(10000)])

		stakingRewards = await (
			await getContractFactory('StakingRewards')
		).deploy(accounts[0].address, accounts[0].address, rewardsToken.address, tokens.crvLINK) //, crvLINKGauge)
		const ownerBalance = await rewardsToken.balanceOf(accounts[0].address)

		await uniswapV2Factory.createPair(rewardsToken.address, tokens.weth)
		const pairAddress = await uniswapV2Factory.getPair(rewardsToken.address, tokens.weth)
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
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should deploy "exotic" strategy', async function () {
		const name = 'Test Strategy2'
		const symbol = 'TEST2'
		const positions = [
			// an "exotic" strategy
			{ token: tokens.dai, percentage: BigNumber.from(200) },
			{ token: tokens.crv, percentage: BigNumber.from(0) },
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
		const Strategy = await hre.ethers.getContractFactory('Strategy', {
			libraries: {
				StrategyClaim: contracts['StrategyClaim'],
			},
		})
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: contracts['StrategyLibrary'],
				ControllerLibrary: contracts['ControllerLibrary'],
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(800)
		await weth.connect(accounts[19]).deposit({ value: value })
		await weth.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, tokens.dai, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		dai = new Contract(tokens.dai, ERC20.abi, accounts[0])
		const value = await dai.balanceOf(accounts[19].address)
		await dai.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, dai.address, weth.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
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
		const Strategy = await hre.ethers.getContractFactory('Strategy', {
			libraries: {
				StrategyClaim: contracts['StrategyClaim'],
			},
		})
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: contracts['StrategyLibrary'],
				ControllerLibrary: contracts['ControllerLibrary'],
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
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
		const Strategy = await hre.ethers.getContractFactory('Strategy', {
			libraries: {
				StrategyClaim: contracts['StrategyClaim'],
			},
		})
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: contracts['StrategyLibrary'],
				ControllerLibrary: contracts['ControllerLibrary'],
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})
})
