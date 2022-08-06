const hre = require('hardhat')
const { ethers } = hre
const chai = require('chai')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, MaxUint256, WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { BigNumber, Contract, Event } from 'ethers'
import { prepareStrategy, Position, StrategyItem, InitialState } from '../lib/encode'
import {
	Platform,
	deployTokens,
	deployUniswapV2,
	deployUniswapV2Adapter,
	deployPlatform,
	deployBatchDepositRouter,
} from '../lib/deploy'
import { displayBalances } from '../lib/logging'
import { DEFAULT_DEPOSIT_SLIPPAGE } from '../lib/constants'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { increaseTime } from '../lib/utils'
import { initializeTestLogging, logTestComplete } from '../lib/convincer'

const NUM_TOKENS = 15

chai.use(solidity)

describe('BatchDepositRouter', function () {
	let proofCounter: number
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

	before('Setup Uniswap + Factory', async function () {
    proofCounter = initializeTestLogging(this, __dirname)
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
		router = await deployBatchDepositRouter(accounts[0], controller, platform.strategyLibrary)
		await whitelist.connect(accounts[0]).approve(router.address)

	  // 'Transfer token balances to account 1'
		const token1Balance = await tokens[1].balanceOf(accounts[0].address)
		const token2Balance = await tokens[2].balanceOf(accounts[0].address)
		await tokens[1].connect(accounts[0]).transfer(accounts[1].address, token1Balance)
		await tokens[2].connect(accounts[0]).transfer(accounts[1].address, token2Balance)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should purchase a token, causing price disparity', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value.mul(2) })
		await weth.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, tokens[1].address, accounts[2].address, accounts[2].address)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) },
		] as Position[]
		strategyItems = prepareStrategy(positions, adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(995),
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}
		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, AddressZero, '0x')
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await platform.getStrategyContractFactory()
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		await tokens[1].connect(accounts[1]).approve(router.address, MaxUint256.toString())
		await tokens[2].connect(accounts[1]).approve(router.address, MaxUint256.toString())
		tx = await controller
			.connect(accounts[1])
			.deposit(
				strategy.address,
				router.address,
				BigNumber.from('10000000000000000'),
				DEFAULT_DEPOSIT_SLIPPAGE,
				'0x'
			)
		receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: platform.strategyLibrary.address,
				ControllerLibrary: controllerLibrary.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		await displayBalances(
			wrapper,
			strategyItems.map((item) => item.item),
			weth
		)
		expect(await wrapper.isBalanced()).to.equal(true)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should purchase a token, requiring a rebalance', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value.mul(2) })
		await weth.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, tokens[1].address, accounts[2].address, accounts[2].address)
		//The following trade should increase the value of the token such that it doesn't need to be rebalanced
		await adapter
			.connect(accounts[2])
			.swap(value.div(4), 0, weth.address, tokens[2].address, accounts[2].address, accounts[2].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(false)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to rebalance: router revert', async function () {
		await increaseTime(5 * 60 + 1)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		).to.be.revertedWith('Rebalance not supported')
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to withdraw: router revert', async function () {
		await expect(
			controller
				.connect(accounts[1])
				.withdrawWETH(strategy.address, router.address, 1, DEFAULT_DEPOSIT_SLIPPAGE, '0x')
		).to.be.revertedWith('Withdraw not supported')
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should restructure', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(300) },
			{ token: tokens[1].address, percentage: BigNumber.from(300) },
			{ token: tokens[2].address, percentage: BigNumber.from(400) },
		] as Position[]
		strategyItems = prepareStrategy(positions, adapter.address)
		await controller.connect(accounts[1]).restructure(strategy.address, strategyItems)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to finalize structure: router revert', async function () {
		await expect(
			controller.connect(accounts[1]).finalizeStructure(strategy.address, router.address, '0x')
		).to.be.revertedWith('Restructure not supported')
	})
})
