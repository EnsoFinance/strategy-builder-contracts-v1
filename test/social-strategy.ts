import { expect } from 'chai'
import { solidity } from 'ethereum-waffle'
const chai = require('chai')
chai.use(solidity)
const hre = require('hardhat')
const { ethers } = hre
import { prepareStrategy, StrategyItem, InitialState } from '../lib/encode'
import { isRevertedWith } from '../lib/errors'
import {
	Platform,
	deployTokens,
	deployUniswapV2,
	deployUniswapV2Adapter,
	deployPlatform,
	deployLoopRouter,
} from '../lib/deploy'
import { increaseTime } from '../lib/utils'
import { DEFAULT_DEPOSIT_SLIPPAGE, TIMELOCK_CATEGORY } from '../lib/constants'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, BigNumber, Event } from 'ethers'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 15
const STRATEGY_STATE: InitialState = {
	timelock: BigNumber.from(60),
	rebalanceThreshold: BigNumber.from(10),
	rebalanceSlippage: BigNumber.from(997),
	restructureSlippage: BigNumber.from(995),
	managementFee: BigNumber.from(5),
	social: true,
	set: false,
}

describe('StrategyController - Social', function () {
	let platform: Platform,
		tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		controllerLibrary: Contract,
		adapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract

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
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[0], tokens)
		platform = await deployPlatform(accounts[0], uniswapFactory, new Contract(AddressZero, [], accounts[0]), weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		controllerLibrary = platform.controllerLibrary
		adapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(adapter.address)
		router = await deployLoopRouter(accounts[0], controller, platform.strategyLibrary)
		await whitelist.connect(accounts[0]).approve(router.address)
	})

	it('Should deploy strategy', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(400) },
			{ token: tokens[1].address, percentage: BigNumber.from(200) },
			{ token: tokens[2].address, percentage: BigNumber.from(200) },
			{ token: tokens[3].address, percentage: BigNumber.from(200) },
		]
		strategyItems = prepareStrategy(positions, adapter.address)

		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy('Test Strategy', 'TEST', strategyItems, STRATEGY_STATE, router.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		let receipt = await tx.wait()
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

		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should deposit more', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[2].address)
		const tx = await controller
			.connect(accounts[2])
			.deposit(strategy.address, router.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[2].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should purchase tokens, requiring a rebalance', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value.mul(2) })
		await weth.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, tokens[1].address, accounts[2].address, accounts[2].address)
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, tokens[2].address, accounts[2].address, accounts[2].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should withdraw', async function () {
		const amount = BigNumber.from('10000000000000')
		const tokenBalanceBefore = BigNumber.from((await tokens[1].balanceOf(strategy.address)).toString())
		const tx = await strategy.connect(accounts[1]).withdrawAll(amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const tokenBalanceAfter = BigNumber.from((await tokens[1].balanceOf(strategy.address)).toString())
		expect(tokenBalanceBefore.gt(tokenBalanceAfter)).to.equal(true)
	})

	it('Should restructure', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(300) },
			{ token: tokens[1].address, percentage: BigNumber.from(300) },
			{ token: tokens[2].address, percentage: BigNumber.from(400) },
		]

		strategyItems = prepareStrategy(positions, adapter.address)
		await controller.connect(accounts[1]).restructure(strategy.address, strategyItems)
	})

	it('Should fail to restructure: time lock active', async function () {
		expect(
			await isRevertedWith(
				controller.connect(accounts[1]).restructure(strategy.address, [], []),
				'Timelock active',
				'StrategyController.sol'
			)
		).to.be.true
	})

	it('Should fail to update value: time lock active', async function () {
		expect(
			await isRevertedWith(
				controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.TIMELOCK, 0),
				'Timelock active',
				'StrategyController.sol'
			)
		).to.be.true
	})

	it('Should fail to finalize structure: time lock not passed', async function () {
		expect(
			await isRevertedWith(
				controller.connect(accounts[1]).finalizeStructure(strategy.address, router.address, '0x'),
				'Timelock active',
				'StrategyController.sol'
			)
		).to.be.true
	})

	it('Should finalize structure', async function () {
		await increaseTime(STRATEGY_STATE.timelock.toNumber())

		await controller.connect(accounts[1]).finalizeStructure(strategy.address, router.address, '0x')
		//await displayBalances(wrapper, strategyItems, weth)
	})

	it('Should purchase a token, requiring a rebalance', async function () {
		const value = WeiPerEther.mul(100)
		await weth.connect(accounts[2]).deposit({ value: value })
		await weth.connect(accounts[2]).approve(adapter.address, value)
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, tokens[2].address, accounts[2].address, accounts[2].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should update timelock + fail to finalize: timelock active', async function () {
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.TIMELOCK, 0)
		expect(
			await isRevertedWith(
				controller.connect(accounts[1]).finalizeValue(strategy.address),
				'Timelock active',
				'StrategyController.sol'
			)
		).to.be.true
	})
})
