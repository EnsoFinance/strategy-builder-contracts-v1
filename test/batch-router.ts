const hre = require('hardhat')
const { ethers } = hre
const chai = require('chai')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, MaxUint256, WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { BigNumber, Contract, Event } from 'ethers'
import { prepareStrategy, Position, StrategyItem, StrategyState } from '../lib/encode'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployBatchDepositRouter } from '../lib/deploy'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

const NUM_TOKENS = 15

chai.use(solidity)

describe('BatchDepositRouter', function () {
	let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		adapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[0], tokens)
		const platform = await deployPlatform(accounts[0], uniswapFactory, weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		adapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(adapter.address)
		router = await deployBatchDepositRouter(accounts[0], controller)
		await whitelist.connect(accounts[0]).approve(router.address)
	})

	before('Transfer token balances to account 1', async function () {
		const token1Balance = await tokens[1].balanceOf(accounts[0].address)
		const token2Balance = await tokens[2].balanceOf(accounts[0].address)
		await tokens[1].connect(accounts[0]).transfer(accounts[1].address, token1Balance)
		await tokens[2].connect(accounts[0]).transfer(accounts[1].address, token2Balance)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) }
		] as Position[]
		strategyItems = prepareStrategy(positions, adapter.address)
		const strategyState: StrategyState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			slippage: BigNumber.from(995),
			performanceFee: BigNumber.from(0),
			social: false
		}
		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				strategyItems,
				strategyState,
				AddressZero,
				'0x'
			)
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		await tokens[1].connect(accounts[1]).approve(router.address, MaxUint256.toString())
		await tokens[2].connect(accounts[1]).approve(router.address, MaxUint256.toString())
		tx = await strategy.connect(accounts[1]).deposit(BigNumber.from('10000000000000000'), router.address, '0x')
		receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
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
			.swap(
				value.div(4),
				0,
				weth.address,
				tokens[2].address,
				accounts[2].address,
				accounts[2].address
			)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should fail to rebalance: router revert', async function () {
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		).to.be.revertedWith('Rebalance not supported')
	})
	/*
	it('Should deposit more', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[1].address)
		const data = ethers.utils.defaultAbiCoder.encode(['bool', 'address[]'], [false, strategyAdapters])
		const tx = await strategy.connect(accounts[1]).deposit(router.address, data, { value: BigNumber.from('10000000000000000') })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[1].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})
	*/

	it('Should restructure', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: BigNumber.from(300) },
			{ token: tokens[1].address, percentage: BigNumber.from(300) },
			{ token: tokens[2].address, percentage: BigNumber.from(400) },
		] as Position[]
		strategyItems = prepareStrategy(positions, adapter.address)
		await controller.connect(accounts[1]).restructure(strategy.address, strategyItems)
	})

	it('Should fail to finalize structure: router revert', async function () {
		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, router.address, '0x')
		).to.be.revertedWith('Restructure not supported')
	})
})
