const hre = require('hardhat')
const { ethers } = hre
const chai = require('chai')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther, MaxUint256 } = constants
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
	calculateAddress,
	encodeTransfer,
	encodeTransferFrom,
	encodeSettleTransfer,
	prepareStrategy,
	prepareRebalanceMulticall,
	Multicall,
	StrategyItem,
	InitialState
} from '../lib/encode'
import {
	deployTokens,
	deployUniswapV2,
	deployMetaStrategyAdapter,
	deployUniswapV2Adapter,
	deployPlatform,
	deployLoopRouter,
	deployMulticallRouter
} from '../lib/deploy'
import { DEFAULT_DEPOSIT_SLIPPAGE } from '../lib/constants'
//import { displayBalances } from '../lib/logging'

const NUM_TOKENS = 15
const STRATEGY_STATE: InitialState = {
	timelock: BigNumber.from(60),
	rebalanceThreshold: BigNumber.from(10),
	rebalanceSlippage: BigNumber.from(997),
	restructureSlippage: BigNumber.from(995),
	performanceFee: BigNumber.from(0),
	social: true,
	set: false
}

chai.use(solidity)

describe('MetaStrategyAdapter', function () {
	let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		loopRouter: Contract,
		multicallRouter: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		library: Contract,
		uniswapAdapter: Contract,
		metaStrategyAdapter: Contract,
		basicStrategy: Contract,
		metaStrategy: Contract,
		metaMetaStrategy: Contract,
		basicStrategyItems: StrategyItem[],
		metaStrategyItems: StrategyItem[],
		mmStrategyItems: StrategyItem[],
		basicWrapper: Contract,
		metaWrapper: Contract,
		metaMetaWrapper: Contract

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[0], tokens)
		const platform = await deployPlatform(accounts[0], uniswapFactory, new Contract(AddressZero, [], accounts[0]), weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		library = platform.library
		loopRouter = await deployLoopRouter(accounts[0], controller, library)
		await whitelist.connect(accounts[0]).approve(loopRouter.address)
		multicallRouter = await deployMulticallRouter(accounts[0], controller)
		await whitelist.connect(accounts[0]).approve(multicallRouter.address)
		uniswapAdapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapAdapter.address)
		metaStrategyAdapter = await deployMetaStrategyAdapter(accounts[0], controller, loopRouter, weth)
		await whitelist.connect(accounts[0]).approve(metaStrategyAdapter.address)
	})

	it('Should deploy basic strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(333) },
			{ token: tokens[2].address, percentage: BigNumber.from(333) },
			{ token: tokens[3].address, percentage: BigNumber.from(334) }
		]
		basicStrategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				basicStrategyItems,
				STRATEGY_STATE,
				loopRouter.address,
				'0x',
				{ value: ethers.BigNumber.from('10000000000000000') }
			)
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		basicStrategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		basicWrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await basicWrapper.deployed()

		expect(await basicWrapper.isBalanced()).to.equal(true)
	})

	it('Should deploy meta strategy', async function () {
		//await displayBalances(basicWrapper, basicStrategyItems.map((item) => item.item), weth)
		const name = 'Meta Strategy'
		const symbol = 'META'
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(400) },
			{ token: tokens[4].address, percentage: BigNumber.from(200) },
			{ token: basicStrategy.address, percentage: BigNumber.from(400), adapters: [metaStrategyAdapter.address], path: [] }
		]
		metaStrategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				metaStrategyItems,
				STRATEGY_STATE,
				loopRouter.address,
				'0x',
				{ value: ethers.BigNumber.from('10000000000000000') }
			)
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		metaStrategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		metaWrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await metaWrapper.deployed()

		//await displayBalances(basicWrapper, basicStrategyItems.map((item) => item.item), weth)
		expect(await metaWrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to deploy meta strategy: reentry', async function () {
		const name = 'Fail strategy'
		const symbol = 'FAIL'
		const create2Address = await calculateAddress(
			strategyFactory,
			accounts[1].address,
			name,
			symbol
		)
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(500) },
			{ token: create2Address, percentage: BigNumber.from(500), adapters: [metaStrategyAdapter.address], path: [] }
		]
		const failItems = prepareStrategy(positions, uniswapAdapter.address)
		await expect(
			strategyFactory
				.connect(accounts[1])
				.createStrategy(
					accounts[1].address,
					name,
					symbol,
					failItems,
					STRATEGY_STATE,
					loopRouter.address,
					'0x'
				)
		).to.be.revertedWith('Cyclic dependency')
	})

	it('Should deploy a meta meta strategy', async function () {
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(500) },
			{ token: metaStrategy.address, percentage: BigNumber.from(500), adapters: [metaStrategyAdapter.address], path: [] }
		]
		mmStrategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				'MetaMeta',
				'MM',
				mmStrategyItems,
				STRATEGY_STATE,
				loopRouter.address,
				'0x',
				{ value: ethers.BigNumber.from('10000000000000000') }
			)
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		metaMetaStrategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		metaMetaWrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await metaMetaWrapper.deployed()
	})

	it('Should purchase a token, requiring a rebalance of basic strategy and meta strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({value: value})
		await weth.connect(accounts[2]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, tokens[1].address, accounts[2].address, accounts[2].address)
		////await displayBalances(wrapper, strategyTokens, weth)
		expect(await metaWrapper.isBalanced()).to.equal(false)
		expect(await basicWrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy: selling basic strategy tokens', async function () {
		//await displayBalances(basicWrapper, basicStrategyItems.map((item) => item.item), weth)
		const balanceBefore = await basicStrategy.balanceOf(metaStrategy.address)
		const tx = await controller.connect(accounts[1]).rebalance(metaStrategy.address, loopRouter.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await basicStrategy.balanceOf(metaStrategy.address)
		//await displayBalances(basicWrapper, basicStrategyItems.map((item) => item.item), weth)
		expect(await metaWrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.lt(balanceBefore)).to.equal(true)
	})

	it('Should rebalance strategy: selling meta strategy tokens', async function () {
		//await displayBalances(basicWrapper, basicStrategyItems.map((item) => item.item), weth)
		//await displayBalances(metaWrapper, metaStrategyItems.map((item) => item.item), weth)
		const balanceBefore = await metaStrategy.balanceOf(metaMetaStrategy.address)
		const tx = await controller.connect(accounts[1]).rebalance(metaMetaStrategy.address, loopRouter.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await metaStrategy.balanceOf(metaMetaStrategy.address)
		////await displayBalances(wrapper, strategyTokens, weth)
		//await displayBalances(basicWrapper, basicStrategyItems.map((item) => item.item), weth)
		//await displayBalances(metaWrapper, metaStrategyItems.map((item) => item.item), weth)
		expect(await metaMetaWrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.lt(balanceBefore)).to.equal(true)
	})

	it('Should purchase a token, causing reduction in basic strategy value', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(50)
		await tokens[2].connect(accounts[0]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[0])
			.swap(value, 0, tokens[2].address, weth.address, accounts[0].address, accounts[0].address)
		////await displayBalances(wrapper, strategyTokens, weth)
		expect(await metaWrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy: buying basic strategy tokens', async function () {
		const balanceBefore = await basicStrategy.balanceOf(metaStrategy.address)
		const tx = await controller.connect(accounts[1]).rebalance(metaStrategy.address, loopRouter.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await basicStrategy.balanceOf(metaStrategy.address)
		////await displayBalances(wrapper, strategyTokens, weth)
		expect(await metaWrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should estimate all strategies', async function () {
		const estimates = await oracle.estimateStrategies([basicStrategy.address, metaStrategy.address, metaMetaStrategy.address])
		expect(estimates.length).to.equal(3)
		estimates.forEach((estimate: BigNumber) => {
			expect(estimate.gt(0)).to.equal(true)
		})
	})

	it('Should fail to swap to weth with MetaStrategyAdapter: no strategy token', async function() {
		const value = await tokens[1].balanceOf(accounts[2].address)
		await tokens[1].connect(accounts[2]).approve(metaStrategyAdapter.address, value)
		await expect(
			metaStrategyAdapter
				.connect(accounts[2])
				.swap(value, 0, tokens[1].address, weth.address, accounts[2].address, accounts[2].address)
		).to.be.revertedWith('')
	})

	it('Should fail to swap from weth with MetaStrategyAdapter: no strategy token', async function() {
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({value: value})
		await weth.connect(accounts[2]).approve(metaStrategyAdapter.address, value)
		await expect(
			metaStrategyAdapter
				.connect(accounts[2])
				.swap(value, 0, weth.address, tokens[1].address, accounts[2].address, accounts[2].address)
		).to.be.revertedWith('')
	})

	it('Should fail to swap from weth with MetaStrategyAdapter: tokens match', async function() {
		const value = WeiPerEther.mul(50)
		await expect(
			metaStrategyAdapter
				.connect(accounts[2])
				.swap(value, 0, weth.address, weth.address, accounts[2].address, accounts[2].address)
		).to.be.revertedWith('Tokens cannot match')
	})

	it('Should fail to swap from weth with MetaStrategyAdapter: no weth', async function() {
		const value = await tokens[1].balanceOf(accounts[2].address)
		await expect(
			metaStrategyAdapter
				.connect(accounts[2])
				.swap(value, 0, tokens[1].address, basicStrategy.address, accounts[2].address, accounts[2].address)
		).to.be.revertedWith('No WETH')
	})

	it('Should fail to swap from weth with MetaStrategyAdapter: insufficient', async function() {
		const value = WeiPerEther.mul(50)
		await expect(
			metaStrategyAdapter
				.connect(accounts[2])
				.swap(value, MaxUint256, weth.address, basicStrategy.address, accounts[2].address, accounts[2].address)
		).to.be.revertedWith('Insufficient tokenOut amount')
	})

	it('Should swap for meta token using MetaStrategyAdapter', async function () {
		// Approve the user to use the adapter
		const balanceBefore = await metaStrategy.balanceOf(accounts[2].address)
		const value = WeiPerEther
		await weth.connect(accounts[2]).deposit({value: value})
		await weth.connect(accounts[2]).approve(metaStrategyAdapter.address, value)
		await metaStrategyAdapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, metaStrategy.address, accounts[2].address, accounts[2].address)
		//await displayBalances(metaWrapper, metaStrategyItems.map((item) => item.item), weth)
		const balanceAfter = await metaStrategy.balanceOf(accounts[2].address)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should attempt steal from metaStrategy using basicStrategy + multicallRouter', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(10)
		await weth.connect(accounts[2]).deposit({value: value})
		await weth.connect(accounts[2]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, tokens[1].address, accounts[2].address, accounts[2].address)

		//const balanceBefore = await metaStrategy.balanceOf(accounts[1].address)

		const depositAmount = WeiPerEther.mul(10)

		const token1Balance = await tokens[1].balanceOf(basicStrategy.address)
		const token2Balance = await tokens[2].balanceOf(basicStrategy.address)
		const token3Balance = await tokens[3].balanceOf(basicStrategy.address)

		//Approve weth to the router in order to later deposit into metaStrategy (in a production environment we would use a flash loan)
		await weth.connect(accounts[1]).deposit({value: depositAmount})
		await weth.connect(accounts[1]).approve(multicallRouter.address, depositAmount);

		//Setup multicall
		const maliciousCalls = [] as Multicall[]
		//Remove all tokens from basicStrategy to reduce its value
		maliciousCalls.push(encodeTransferFrom(tokens[1], basicStrategy.address, multicallRouter.address, token1Balance))
		maliciousCalls.push(encodeTransferFrom(tokens[2], basicStrategy.address, multicallRouter.address, token2Balance))
		maliciousCalls.push(encodeTransferFrom(tokens[3], basicStrategy.address, multicallRouter.address, token3Balance))
		//Now metaStrategy will be worth less, deposit into it to get a greater than fair share
		maliciousCalls.push(encodeTransferFrom(weth, accounts[1].address, multicallRouter.address, depositAmount))
		const depositCalls = [] as Multicall[]
		depositCalls.push(encodeTransfer(weth, metaStrategy.address, depositAmount))
		const depositData = await multicallRouter.encodeCalls(depositCalls)
		const depositEncoded = controller.interface.encodeFunctionData('deposit', [metaStrategy.address, multicallRouter.address, depositAmount, DEFAULT_DEPOSIT_SLIPPAGE, depositData])
		maliciousCalls.push({ target: controller.address, callData: depositEncoded })
		//Send all newly minted strategy tokens to account 1
		maliciousCalls.push(encodeSettleTransfer(multicallRouter, metaStrategy.address, accounts[1].address))
		//Return all tokens to basicStrategy
		maliciousCalls.push(encodeTransfer(tokens[1], basicStrategy.address, token1Balance))
		maliciousCalls.push(encodeTransfer(tokens[2], basicStrategy.address, token2Balance))
		maliciousCalls.push(encodeTransfer(tokens[3], basicStrategy.address, token3Balance))
		//Do regular rebalance
		const rebalanceCalls = await prepareRebalanceMulticall(basicStrategy, multicallRouter, uniswapAdapter, oracle, weth)
		//Encode multicalls and rebalance
		const rebalanceData = await multicallRouter.encodeCalls([...maliciousCalls, ...rebalanceCalls])
		await expect(controller.connect(accounts[1]).rebalance(basicStrategy.address, multicallRouter.address, rebalanceData)).to.be.revertedWith('')
		/*
		const balanceAfter = await metaStrategy.balanceOf(accounts[1].address)
		const totalSupply = await metaStrategy.totalSupply()
		const [total, ] = await oracle.estimateStrategy(metaStrategy.address)
		const addedValue = total.mul(balanceAfter.sub(balanceBefore)).div(totalSupply)
		console.log('Stolen value: ', addedValue.sub(depositAmount).toString());
		expect(addedValue.gt(depositAmount)).to.equal(true)
		*/
	})
})
