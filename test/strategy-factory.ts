import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract, BigNumber, Event } from 'ethers'
import {
	Platform,
	deployTokens,
	deployUniswapV2,
	deployUniswapV2Adapter,
	deployPlatform,
	deployLoopRouter,
} from '../lib/deploy'
import { prepareStrategy, StrategyItem, InitialState } from '../lib/encode'
import { DEFAULT_DEPOSIT_SLIPPAGE } from '../lib/constants'
import { isRevertedWith } from '../lib/errors'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
const { constants, getSigners } = ethers
const { AddressZero, MaxUint256, WeiPerEther } = constants
import { increaseTime } from '../lib/utils'
import { initializeTestLogging, logTestComplete } from '../lib/convincer'

const chai = require('chai')
import { solidity } from 'ethereum-waffle'
chai.use(solidity)

const NUM_TOKENS = 15

describe('StrategyProxyFactory', function () {
	let proofCounter: number
	let platform: Platform,
		tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		newFactory: Contract,
		controller: Contract,
		oracle: Contract,
		newOracle: Contract,
		newWhitelist: Contract,
		whitelist: Contract,
		adapter: Contract,
		newRouter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		newImplementationAddress: string

	before('Setup Uniswap + Factory', async function () {
    proofCounter = initializeTestLogging(this, __dirname)
		accounts = await getSigners()
		tokens = await deployTokens(accounts[10], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[10], tokens)
		platform = await deployPlatform(accounts[10], uniswapFactory, new Contract(AddressZero, [], accounts[10]), weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		adapter = await deployUniswapV2Adapter(accounts[10], uniswapFactory, weth)
		await whitelist.connect(accounts[10]).approve(adapter.address)
		router = await deployLoopRouter(accounts[10], controller, platform.strategyLibrary)
		await whitelist.connect(accounts[10]).approve(router.address)
	})

	before('Setup new implementation, oracle, whitelist', async function () {
		const platform = await deployPlatform(
			accounts[10],
			uniswapFactory,
			new Contract(AddressZero, [], accounts[10]),
			weth
		)
		newFactory = platform.strategyFactory
		newOracle = platform.oracles.ensoOracle
		newWhitelist = platform.administration.whitelist
		newRouter = await deployLoopRouter(accounts[10], controller, platform.strategyLibrary)
		await newWhitelist.connect(accounts[10]).approve(adapter.address)
		await newWhitelist.connect(accounts[10]).approve(newRouter.address)
		newImplementationAddress = await newFactory.implementation()
	})

	before('Should deploy strategy', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) },
		]
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

		const amount = ethers.BigNumber.from('10000000000000000')
		const Strategy = await platform.getStrategyContractFactory()

		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy('Test Strategy', 'TEST', strategyItems, strategyState, router.address, '0x', {
				value: amount,
			})
		let receipt = await tx.wait()
		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		strategy = Strategy.attach(strategyAddress)
	})

	it('Should fail to deploy strategy: already exists', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) },
		]
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

		const amount = ethers.BigNumber.from('10000000000000000')

		await expect(
			strategyFactory
				.connect(accounts[1])
				.createStrategy('Test Strategy', 'TEST', strategyItems, strategyState, router.address, '0x', {
					value: amount,
				})
		).to.be.revertedWith('_createProxy: proxy already exists.')
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should check controller value', async function () {
		expect(await strategyFactory.controller()).to.equal(controller.address)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to update oracle: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).updateOracle(newOracle.address)).to.be.revertedWith(
			'Not owner'
		)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should update oracle', async function () {
		expect(await controller.oracle()).to.equal(oracle.address)
		await strategyFactory.connect(accounts[10]).updateOracle(newOracle.address)
		expect(await strategyFactory.oracle()).to.equal(newOracle.address)
		expect(await controller.oracle()).to.equal(oracle.address)
		await controller.updateAddresses()
		expect(await controller.oracle()).to.equal(newOracle.address)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should update rebalanceParameters', async function () {
		expect(
			await isRevertedWith(
				// sanity check
				controller.connect(accounts[5]).finalizeRebalanceParameters(),
				'updateRebalanceParameters timelock not ready.',
				'StrategyController.sol'
			)
		).to.be.true
		let rebalanceTimelockPeriod = 5 * 60
		let rebalanceThresholdScalar = 1000
		await strategyFactory
			.connect(accounts[10])
			.updateRebalanceParameters(rebalanceTimelockPeriod, rebalanceThresholdScalar)
		await increaseTime(5 * 60 + 1)
		await controller.connect(accounts[5]).finalizeRebalanceParameters()
		expect(await controller.callStatic.rebalanceThresholdScalar()).to.eq(rebalanceThresholdScalar)

		// settle on this value
		rebalanceThresholdScalar = 2000
		await strategyFactory
			.connect(accounts[10])
			.updateRebalanceParameters(rebalanceTimelockPeriod, rebalanceThresholdScalar)
		await increaseTime(5 * 60 + 1)
		await controller.connect(accounts[5]).finalizeRebalanceParameters()
		expect(await controller.callStatic.rebalanceThresholdScalar()).to.eq(rebalanceThresholdScalar)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to update whitelist: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).updateWhitelist(newWhitelist.address)).to.be.revertedWith(
			'Not owner'
		)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should update whitelist', async function () {
		const oldBalance = await strategy.balanceOf(accounts[1].address)
		expect(
			await isRevertedWith(
				controller
					.connect(accounts[1])
					.deposit(strategy.address, newRouter.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', {
						value: ethers.BigNumber.from('10000000000000000'),
					}),
				'Not approved',
				'StrategyController.sol'
			)
		).to.be.true
		await strategyFactory.connect(accounts[10]).updateWhitelist(newWhitelist.address)
		expect(await strategyFactory.whitelist()).to.equal(newWhitelist.address)
		await controller.updateAddresses()
		await controller
			.connect(accounts[1])
			.deposit(strategy.address, newRouter.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		const newBalance = await strategy.balanceOf(accounts[1].address)
		expect(ethers.BigNumber.from(newBalance).gt(oldBalance)).to.equal(true)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to update pool: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).updatePool(accounts[1].address)).to.be.revertedWith(
			'Not owner'
		)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should update pool', async function () {
		await strategyFactory.connect(accounts[10]).updatePool(accounts[0].address)
		expect(await strategyFactory.pool()).to.equal(accounts[0].address)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to add item: not owner', async function () {
		await expect(
			strategyFactory.connect(accounts[1]).addItemToRegistry(0, 0, tokens[1].address)
		).to.be.revertedWith('Not owner')
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to add item: invalid category', async function () {
		await expect(
			strategyFactory.connect(accounts[10]).addItemToRegistry(0, 100, tokens[1].address)
		).to.be.revertedWith('Invalid category')
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to update implementation: not owner', async function () {
		await expect(
			strategyFactory.connect(accounts[1]).updateImplementation(newImplementationAddress, '2')
		).to.be.revertedWith('Not owner')
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to update implementation to 1', async function () {
		await expect(
			strategyFactory.connect(accounts[10]).updateImplementation(newImplementationAddress, '1')
		).to.be.revertedWith('Invalid version')
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to update implementation to 0', async function () {
		await expect(
			strategyFactory.connect(accounts[10]).updateImplementation(newImplementationAddress, '0')
		).to.be.revertedWith('Invalid version')
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to update minor version 2.1', async function () {
		await expect(
			strategyFactory.connect(accounts[10]).updateImplementation(newImplementationAddress, '2.1')
		).to.be.revertedWith('Invalid string integer')
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to update proxy version: not admin', async function () {
		await expect(strategyFactory.connect(accounts[1]).updateProxyVersion(strategy.address)).to.be.revertedWith(
			'Only admin'
		)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to transfer ownership: not owner', async function () {
		await expect(strategyFactory.connect(accounts[2]).transferOwnership(accounts[2].address)).to.be.revertedWith(
			'Not owner'
		)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to transfer ownership: zero address', async function () {
		await expect(strategyFactory.connect(accounts[10]).transferOwnership(AddressZero)).to.be.revertedWith(
			'Zero address provided'
		)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should transfer ownership', async function () {
		await strategyFactory.connect(accounts[10]).transferOwnership(accounts[2].address)
		expect(await strategyFactory.owner()).to.equal(accounts[2].address)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to renounce ownership: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).renounceOwnership()).to.be.revertedWith('Not owner')
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should update implementation to version uint256.max()', async function () {
		const version = await strategyFactory.version()
		expect(await strategy.version()).to.eq(version)

		await strategyFactory.connect(accounts[2]).updateImplementation(newImplementationAddress, MaxUint256.toString())
		expect(await strategyFactory.implementation()).to.equal(newImplementationAddress)
		expect(ethers.BigNumber.from(await strategyFactory.version()).eq(MaxUint256.toString())).to.equal(true)
    logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should transfer ownership', async function () {
		await strategyFactory.connect(accounts[2]).renounceOwnership()
		expect(await strategyFactory.owner()).to.equal(AddressZero)
    logTestComplete(this, __dirname, proofCounter++)
	})
})
