import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract, BigNumber, Event } from 'ethers'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployLoopRouter } from '../lib/deploy'
import { StrategyBuilder } from '../lib/encode'
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const chai = require('chai')
import { solidity } from 'ethereum-waffle'
chai.use(solidity)

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH: Contract

describe('StrategyProxyFactory', function () {
		let tokens: Contract[],
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
		strategyTokens: string[],
		strategyPercentages: BigNumber[],
		strategyAdapters: string[],
		newImplementationAddress: string

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[0], tokens)
		const p = await deployPlatform(accounts[0], uniswapFactory, WETH)
		;[strategyFactory, controller, oracle, whitelist] = [p.strategyFactory, p.controller, p.oracle, p.whitelist]
		adapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, WETH)
		router = await deployLoopRouter(accounts[0], controller, adapter, WETH)
		await whitelist.connect(accounts[0]).approve(router.address)
	})

	before('Setup new implementation, oracle, whitelist', async function () {
		const p = await deployPlatform(accounts[0], uniswapFactory, WETH)
		;[newFactory, newOracle, newWhitelist] = [p.strategyFactory, p.oracle, p.whitelist]
		newRouter = await deployLoopRouter(accounts[0], controller, adapter, WETH)
		await newWhitelist.connect(accounts[0]).approve(newRouter.address)
		newImplementationAddress = await newFactory.implementation()
	})

	before('Should deploy strategy', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) },
		]
		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]
		const amount = ethers.BigNumber.from('10000000000000000')
		const Strategy = await getContractFactory('Strategy')
		//First strategy
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				'Test Strategy',
				'TEST',
				strategyTokens,
				strategyPercentages,
				false,
				0,
				REBALANCE_THRESHOLD,
				SLIPPAGE,
				TIMELOCK,
				router.address,
				data,
				{ value: amount }
			)
		let receipt = await tx.wait()
		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		strategy = Strategy.attach(strategyAddress)

		// //Second strategy
		// TODO: not used
		// tx = await strategyFactory
		// 	.connect(accounts[1])
		// 	.createStrategy(
		// 		accounts[1].address,
		// 		'Test Strategy 2',
		// 		'TEST2',
		// 		strategyTokens,
		// 		strategyPercentages,
		// 		false,
		// 		0,
		// 		REBALANCE_THRESHOLD,
		// 		SLIPPAGE,
		// 		TIMELOCK,
		// 		router.address,
		// 		'0x'
		// 	)
		// receipt = await tx.wait()
		// const strategyAddress2 = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		// strategyTwo = Strategy.attach(strategyAddress2)
	})

	it('Should fail to set controller: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).setController(accounts[1].address)).to.be.revertedWith(
			'Not owner'
		)
	})

	it('Should fail to set controller: already set', async function () {
		await expect(strategyFactory.connect(accounts[0]).setController(accounts[1].address)).to.be.revertedWith(
			'Cannot change controller'
		)
	})

	it('Should fail to update oracle: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).updateOracle(newOracle.address)).to.be.revertedWith(
			'Not owner'
		)
	})

	it('Should update oracle', async function () {
		expect(await strategy.oracle()).to.equal(oracle.address)
		await strategyFactory.connect(accounts[0]).updateOracle(newOracle.address)
		expect(await strategyFactory.oracle()).to.equal(newOracle.address)
		expect(await strategy.oracle()).to.equal(newOracle.address)
	})

	it('Should fail to update whitelist: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).updateWhitelist(newWhitelist.address)).to.be.revertedWith(
			'Not owner'
		)
	})

	it('Should update whitelist', async function () {
		const oldBalance = await strategy.balanceOf(accounts[1].address)
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, newRouter.address, data, {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		).to.be.revertedWith('Router not approved')
		await strategyFactory.connect(accounts[0]).updateWhitelist(newWhitelist.address)
		expect(await strategyFactory.whitelist()).to.equal(newWhitelist.address)
		await controller
			.connect(accounts[1])
			.deposit(strategy.address, newRouter.address, data, { value: ethers.BigNumber.from('10000000000000000') })
		const newBalance = await strategy.balanceOf(accounts[1].address)
		expect(ethers.BigNumber.from(newBalance).gt(oldBalance)).to.equal(true)
	})

	it('Should fail to update implementation: not owner', async function () {
		await expect(
			strategyFactory.connect(accounts[1]).updateImplementation(newImplementationAddress, '2')
		).to.be.revertedWith('Not owner')
	})

	it('Should fail to update implementation to 1', async function () {
		await expect(
			strategyFactory.connect(accounts[0]).updateImplementation(newImplementationAddress, '1')
		).to.be.revertedWith('Invalid version')
	})

	it('Should fail to update implementation to 0', async function () {
		await expect(
			strategyFactory.connect(accounts[0]).updateImplementation(newImplementationAddress, '0')
		).to.be.revertedWith('Invalid version')
	})

	it('Should fail to update minor version 2.1', async function () {
		await expect(
			strategyFactory.connect(accounts[0]).updateImplementation(newImplementationAddress, '2.1')
		).to.be.revertedWith('Invalid string integer')
	})

	it('Should update implementation to version uint256.max()', async function () {
		const version = await strategyFactory.version();
		expect(await strategy.version()).to.eq(version);

		await strategyFactory.connect(accounts[0]).updateImplementation(newImplementationAddress, ethers.constants.MaxUint256.toString())
		expect(await strategyFactory.implementation()).to.equal(newImplementationAddress)
		expect(ethers.BigNumber.from(await strategyFactory.version()).eq(ethers.constants.MaxUint256.toString())).to.equal(true)
		expect(await strategyFactory.getProxyImplementation(strategy.address)).to.not.equal(newImplementationAddress)
	})

	it('Should fail to upgrade strategy proxy: not manager', async function () {
		await expect(strategyFactory.connect(accounts[0]).upgrade(strategy.address)).to.be.revertedWith('Not manager')
	})

	it('Should fail to upgrade Strategy proxy: calling to strategy directly', async function () {
		await expect(strategy.connect(accounts[0]).updateVersion(await strategyFactory.version())).to.be.revertedWith('Only StrategyFactory')
	})

	it('Should upgrade strategy proxy', async function () {
		const factoryVersion = await strategyFactory.version();
		expect(await strategy.version()).to.not.eq(factoryVersion);
		await strategyFactory.connect(accounts[1]).upgrade(strategy.address)
		expect(await strategyFactory.getProxyImplementation(strategy.address)).to.equal(newImplementationAddress)
		expect(await strategy.version()).to.eq(factoryVersion)
	})

	it('Should fail to get implementation: not proxy admin', async function () {
		await expect(newFactory.getProxyImplementation(strategy.address)).to.be.revertedWith('')
	})

	it('Should fail to get proxy admin: not proxy admin', async function () {
		await expect(newFactory.getProxyAdmin(strategy.address)).to.be.revertedWith('')
	})

	it('Should get proxy admin', async function () {
		expect(await strategyFactory.getProxyAdmin(strategy.address)).to.equal(strategyFactory.address)
	})

	it('Should fail to transfer ownership: not owner', async function () {
		await expect(strategyFactory.connect(accounts[2]).transferOwnership(accounts[2].address)).to.be.revertedWith(
			'Not owner'
		)
	})

	it('Should fail to transfer ownership: zero address', async function() {
		await expect(strategyFactory.connect(accounts[0]).transferOwnership(AddressZero)).to.be.revertedWith('Zero address provided')
	})

	it('Should transfer ownership', async function () {
		await strategyFactory.connect(accounts[0]).transferOwnership(accounts[2].address)
		expect(await strategyFactory.owner()).to.equal(accounts[2].address)
	})

	it('Should fail to renounce ownership: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).renounceOwnership()).to.be.revertedWith('Not owner')
	})

	it('Should transfer ownership', async function () {
		await strategyFactory.connect(accounts[2]).renounceOwnership()
		expect(await strategyFactory.owner()).to.equal(AddressZero)
	})
})
