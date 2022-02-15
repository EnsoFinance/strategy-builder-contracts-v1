import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract, BigNumber, Event } from 'ethers'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployLoopRouter } from '../lib/deploy'
import { prepareStrategy, StrategyItem, InitialState } from '../lib/encode'
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
const { constants, getContractFactory, getSigners } = ethers
const { MaxUint256, WeiPerEther, AddressZero } = constants

const chai = require('chai')
import { solidity } from 'ethereum-waffle'
chai.use(solidity)

const NUM_TOKENS = 15

describe('StrategyProxyAdmin', function () {
		let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		strategyAdmin: Contract,
		newAdmin: Contract,
		newImplementation: Contract,
		controller: Contract,
		whitelist: Contract,
		adapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[]

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[10], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[10], tokens)
		const platform = await deployPlatform(accounts[10], uniswapFactory, new Contract(AddressZero, [], accounts[10]), weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		whitelist = platform.administration.whitelist
		const library = platform.library
		const strategyAdminAddress = await strategyFactory.admin()
		const StrategyAdmin = await getContractFactory('StrategyProxyAdmin')
		strategyAdmin = await StrategyAdmin.attach(strategyAdminAddress)
		adapter = await deployUniswapV2Adapter(accounts[10], uniswapFactory, weth)
		await whitelist.connect(accounts[10]).approve(adapter.address)
		router = await deployLoopRouter(accounts[10], controller, library)
		await whitelist.connect(accounts[10]).approve(router.address)
	})

	before('Setup new implementation + admin', async function () {
		const StrategyAdmin = await getContractFactory('StrategyProxyAdmin')
		newAdmin = await StrategyAdmin.connect(accounts[10]).deploy()
		const Strategy = await getContractFactory('Strategy')
		newImplementation = await Strategy.deploy(strategyFactory.address, controller.address, AddressZero, AddressZero)
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
			performanceFee: BigNumber.from(0),
			social: false,
			set: false
		}

		const amount = ethers.BigNumber.from('10000000000000000')
		const Strategy = await getContractFactory('Strategy')

		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				'Test Strategy',
				'TEST',
				strategyItems,
				strategyState,
				router.address,
				'0x',
				{ value: amount }
			)
		let receipt = await tx.wait()
		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		strategy = Strategy.attach(strategyAddress)
	})

	it('Should update implementation to version uint256.max()', async function () {
		const version = await strategyFactory.version();
		expect(await strategy.version()).to.eq(version);

		await strategyFactory.connect(accounts[10]).updateImplementation(newImplementation.address, MaxUint256.toString())
		expect(await strategyFactory.implementation()).to.equal(newImplementation.address)
		expect(ethers.BigNumber.from(await strategyFactory.version()).eq(MaxUint256.toString())).to.equal(true)
		expect(await strategyAdmin.getProxyImplementation(strategy.address)).to.not.equal(newImplementation.address)
	})

	it('Should fail to upgrade strategy proxy: not manager', async function () {
		await expect(strategyAdmin.connect(accounts[10]).upgrade(strategy.address)).to.be.revertedWith('Not manager')
	})

	it('Should fail to upgrade Strategy proxy: calling to strategy directly', async function () {
		await expect(strategy.connect(accounts[10]).updateVersion(await strategyFactory.version())).to.be.revertedWith('Only StrategyProxyFactory')
	})

	it('Should upgrade strategy proxy', async function () {
		const factoryVersion = await strategyFactory.version();
		expect(await strategy.version()).to.not.eq(factoryVersion);
		await strategyAdmin.connect(accounts[1]).upgrade(strategy.address)
		expect(await strategyAdmin.getProxyImplementation(strategy.address)).to.equal(newImplementation.address)
		expect(await strategy.version()).to.eq(factoryVersion)
	})

	it('Should fail to get implementation: not proxy admin', async function () {
		await expect(newAdmin.getProxyImplementation(strategy.address)).to.be.revertedWith('')
	})

	it('Should fail to get proxy admin: not proxy admin', async function () {
		await expect(newAdmin.getProxyAdmin(strategy.address)).to.be.revertedWith('')
	})

	it('Should get proxy admin', async function () {
		expect(await strategyAdmin.getProxyAdmin(strategy.address)).to.equal(strategyAdmin.address)
	})
})
