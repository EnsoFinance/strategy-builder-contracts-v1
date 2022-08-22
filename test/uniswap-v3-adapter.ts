import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
const { expect } = require('chai')

const { ethers, waffle } = require('hardhat')
import { Contract, BigNumber, Event } from 'ethers'
const { deployContract } = waffle
const { constants, getContractFactory, getSigners } = ethers
const { WeiPerEther, AddressZero } = constants
import { deployTokens, deployUniswapV3, deployUniswapV3Adapter, deployLoopRouter } from '../lib/deploy'
import { encodePath, prepareStrategy, Position, StrategyItem, InitialState } from '../lib/encode'
import { increaseTime, getDeadline, encodePriceSqrt, getMaxTick, getMinTick } from '../lib/utils'
import { initializeTestLogging, logTestComplete } from '../lib/convincer'
import { ITEM_CATEGORY, ESTIMATOR_CATEGORY, UNI_V3_FEE, ORACLE_TIME_WINDOW } from '../lib/constants'
import { createLink, linkBytecode } from '../lib/link'

import StrategyController from '../artifacts/contracts/StrategyController.sol/StrategyController.json'
import ControllerLibrary from '../artifacts/contracts/libraries/ControllerLibrary.sol/ControllerLibrary.json'
import StrategyLibrary from '../artifacts/contracts/libraries/StrategyLibrary.sol/StrategyLibrary.json'
import SwapRouter from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'

import StrategyClaim from '../artifacts/contracts/libraries/StrategyClaim.sol/StrategyClaim.json'

const NUM_TOKENS = 4

let tokens: Contract[],
	weth: Contract,
	accounts: SignerWithAddress[],
	strategyFactory: Contract,
	controller: Contract,
	oracle: Contract,
	controllerLibrary: Contract,
	uniswapOracle: Contract,
	adapter: Contract,
	router: Contract,
	strategy: Contract,
	strategyLibrary: Contract,
	strategyClaim: Contract,
	wrapper: Contract,
	uniswapRegistry: Contract,
	uniswapNFTManager: Contract,
	uniswapV3Factory: Contract,
	uniswapRouter: Contract,
	uniswapQuoter: Contract,
	owner: SignerWithAddress,
	trader: SignerWithAddress,
	strategyItems: StrategyItem[]

async function exactInput(tokens: string[], amountIn: number, amountOutMinimum: number) {
	const inputIsWETH = weth.address === tokens[0]
	const outputIsWETH = tokens[tokens.length - 1] === weth.address

	const value = inputIsWETH ? amountIn : 0

	const params = {
		path: encodePath(tokens, new Array(tokens.length - 1).fill(UNI_V3_FEE)),
		recipient: outputIsWETH ? uniswapRouter.address : trader.address,
		deadline: await getDeadline(100000),
		amountIn,
		amountOutMinimum,
	}

	const data = [uniswapRouter.interface.encodeFunctionData('exactInput', [params])]
	if (outputIsWETH)
		data.push(uniswapRouter.interface.encodeFunctionData('unwrapWETH9', [amountOutMinimum, trader.address]))

	// optimized for the gas test
	return data.length === 1
		? uniswapRouter.connect(trader).exactInput(params, { value })
		: uniswapRouter.connect(trader).multicall(data, { value })
}

describe('UniswapV3Adapter', function () {
	let proofCounter: number
	before('Setup Uniswap V3 + Platform', async function () {
		proofCounter = initializeTestLogging(this, __dirname)
		accounts = await getSigners()
		owner = accounts[5]
		trader = accounts[6]
		tokens = await deployTokens(owner, NUM_TOKENS, WeiPerEther.mul(100).mul(NUM_TOKENS - 1))
		weth = tokens[0]
		;[uniswapV3Factory, uniswapNFTManager] = await deployUniswapV3(owner, tokens)
		// Create non weth pool
		const aNum = ethers.BigNumber.from(tokens[1].address)
		const bNum = ethers.BigNumber.from(tokens[2].address)
		const flipper = aNum.lt(bNum)
		await uniswapNFTManager.createAndInitializePoolIfNecessary(
			flipper ? tokens[1].address : tokens[2].address,
			flipper ? tokens[2].address : tokens[1].address,
			UNI_V3_FEE,
			encodePriceSqrt(1, 1)
		)
		// Mint
		await uniswapNFTManager.connect(owner).mint({
			token0: flipper ? tokens[1].address : tokens[2].address,
			token1: flipper ? tokens[2].address : tokens[1].address,
			tickLower: getMinTick(60),
			tickUpper: getMaxTick(60),
			fee: UNI_V3_FEE,
			recipient: owner.address,
			amount0Desired: WeiPerEther, //Lower liquidity
			amount1Desired: WeiPerEther, //Lower liquidity
			amount0Min: 0,
			amount1Min: 0,
			deadline: getDeadline(240),
		})

		uniswapRouter = await deployContract(owner, SwapRouter, [uniswapV3Factory.address, weth.address])

		const UniswapV3Registry = await getContractFactory('UniswapV3Registry')
		uniswapRegistry = await UniswapV3Registry.connect(owner).deploy(uniswapV3Factory.address, weth.address)
		await uniswapRegistry.deployed()

		const UniswapOracle = await getContractFactory('UniswapV3Oracle')
		uniswapOracle = await UniswapOracle.connect(owner).deploy(uniswapRegistry.address, weth.address)
		await uniswapOracle.deployed()

		const TokenRegistry = await getContractFactory('TokenRegistry')
		const tokenRegistry = await TokenRegistry.connect(owner).deploy()

		const BasicEstimator = await getContractFactory('BasicEstimator')
		const basicEstimator = await BasicEstimator.connect(owner).deploy(uniswapOracle.address)

		const StrategyEstimator = await getContractFactory('StrategyEstimator')
		const strategyEstimator = await StrategyEstimator.connect(owner).deploy()

		await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.DEFAULT_ORACLE, basicEstimator.address)
		await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.STRATEGY, strategyEstimator.address)
		await tokenRegistry
			.connect(owner)
			.addItem(ITEM_CATEGORY.RESERVE, ESTIMATOR_CATEGORY.DEFAULT_ORACLE, weth.address)

		const Whitelist = await getContractFactory('Whitelist')
		const whitelist = await Whitelist.connect(owner).deploy()
		await whitelist.deployed()

		const PlatformProxyAdmin = await getContractFactory('PlatformProxyAdmin')
		const platformProxyAdmin = await PlatformProxyAdmin.connect(owner).deploy()
		await platformProxyAdmin.deployed()
		const controllerAddress = await platformProxyAdmin.controller()
		const factoryAddress = await platformProxyAdmin.factory()

		const EnsoOracle = await getContractFactory('EnsoOracle')
		oracle = await EnsoOracle.connect(owner).deploy(factoryAddress, weth.address, AddressZero)
		await oracle.deployed()

		strategyLibrary = await waffle.deployContract(accounts[0], StrategyLibrary, [])
		await strategyLibrary.deployed()
		const strategyLibraryLink = createLink(StrategyLibrary, strategyLibrary.address)

		controllerLibrary = await waffle.deployContract(
			accounts[0],
			linkBytecode(ControllerLibrary, [strategyLibraryLink]),
			[]
		)
		await controllerLibrary.deployed()
		const controllerLibraryLink = createLink(ControllerLibrary, controllerLibrary.address)

		const controllerImplementation = await waffle.deployContract(
			accounts[0],
			linkBytecode(StrategyController, [controllerLibraryLink]),
			[factoryAddress]
		)
		await controllerImplementation.deployed()

		const StrategyProxyFactory = await getContractFactory('StrategyProxyFactory')
		const factoryImplementation = await StrategyProxyFactory.connect(owner).deploy(controllerAddress)
		await factoryImplementation.deployed()

		strategyClaim = await waffle.deployContract(accounts[0], StrategyClaim, [])
		await strategyClaim.deployed()

		const Strategy = await getContractFactory('Strategy', {
			libraries: { StrategyClaim: strategyClaim.address },
		})
		const strategyImplementation = await Strategy.connect(owner).deploy(
			factoryAddress,
			controllerAddress,
			AddressZero,
			AddressZero
		)
		await strategyImplementation.deployed()

		await platformProxyAdmin.initialize(
			controllerImplementation.address,
			factoryImplementation.address,
			strategyImplementation.address,
			oracle.address,
			tokenRegistry.address,
			whitelist.address,
			owner.address
		)

		strategyFactory = await StrategyProxyFactory.attach(factoryAddress)
		controller = new Contract(controllerAddress, StrategyController.abi, accounts[0])

		await tokenRegistry.connect(owner).transferOwnership(factoryAddress)

		adapter = await deployUniswapV3Adapter(owner, uniswapRegistry, uniswapRouter, weth)
		await whitelist.connect(owner).approve(adapter.address)

		router = await deployLoopRouter(accounts[0], controller, strategyLibrary)
		await whitelist.connect(owner).approve(router.address)

		uniswapQuoter = await deployContract(trader, Quoter, [uniswapV3Factory.address, weth.address])
	})

	it('Should initialize all tokens', async function () {
		for (let i = 1; i < tokens.length; i++) {
			await uniswapRegistry.addPool(tokens[i].address, weth.address, UNI_V3_FEE, ORACLE_TIME_WINDOW)
		}
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

		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', {
				value: BigNumber.from('10000000000000000'),
			})
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy', {
			libraries: { StrategyClaim: strategyClaim.address },
		})
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: strategyLibrary.address,
				ControllerLibrary: controllerLibrary.address,
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should swap on uniswap, requiring rebalance', async function () {
		await exactInput([weth.address, tokens[1].address], WeiPerEther.mul(20), 0)
		await increaseTime(60)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should check oracle price', async function () {
		const quote = await uniswapQuoter.callStatic.quoteExactInput(
			encodePath([tokens[1].address, weth.address], [UNI_V3_FEE]),
			WeiPerEther
		)
		console.log('Quote Price: ', quote.toString())
		const oraclePrice = await uniswapOracle.consult(WeiPerEther, tokens[1].address)
		console.log('Oracle Price: ', oraclePrice.toString())
		expect(oraclePrice.gt(0)).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should swap on uniswap, requiring rebalance', async function () {
		const balance = await tokens[1].balanceOf(trader.address)
		await exactInput([weth.address, tokens[1].address], balance, 0)
		await increaseTime(60)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to deploy strategy: swap failed', async function () {
		const name = 'Fail Strategy'
		const symbol = 'FAIL'
		const positions = [
			{
				token: tokens[2].address,
				percentage: BigNumber.from(1000),
				adapters: [adapter.address, adapter.address], // Try to trade via token 1 without token1-token2 fee being set
				path: [tokens[1].address],
			},
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

		await expect(
			strategyFactory
				.connect(accounts[1])
				.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', {
					value: BigNumber.from('10000000000000000'),
				})
		).to.be.revertedWith('Pair fee not registered')
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to add fee: pool already added', async function () {
		await expect(
			uniswapRegistry.connect(owner).addFee(tokens[1].address, weth.address, UNI_V3_FEE)
		).to.be.revertedWith('Pool already registered')
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to add fee: no pool', async function () {
		await expect(
			uniswapRegistry.connect(owner).addFee(tokens[1].address, tokens[3].address, UNI_V3_FEE)
		).to.be.revertedWith('Not valid pool')
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to add fee: invalid fee', async function () {
		await expect(uniswapRegistry.connect(owner).addFee(tokens[1].address, tokens[2].address, 1)).to.be.revertedWith(
			'Not valid pool'
		)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to add fee: not owner', async function () {
		await expect(
			uniswapRegistry.connect(trader).addFee(tokens[1].address, tokens[2].address, UNI_V3_FEE)
		).to.be.revertedWith('Ownable: caller is not the owner')
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should add fee', async function () {
		await uniswapRegistry.connect(owner).addFee(tokens[1].address, tokens[2].address, UNI_V3_FEE)

		const fee = await uniswapRegistry.getFee(tokens[1].address, tokens[2].address)
		expect(BigNumber.from(fee).eq(UNI_V3_FEE)).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should deploy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST2'
		const positions = [
			{
				token: tokens[2].address,
				percentage: BigNumber.from(1000),
				adapters: [adapter.address, adapter.address], // Trade via token 1 with token1-token2 fee set
				path: [tokens[1].address],
			},
		] as Position[]
		strategyItems = prepareStrategy(positions, adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			rebalanceSlippage: BigNumber.from(995),
			restructureSlippage: BigNumber.from(500), // bad slippage, but this is just to test storing multiple fee pairings
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}

		await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', {
				value: BigNumber.from('10000000000000000'),
			})
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to remove fee: cannot remove pool fee', async function () {
		await expect(uniswapRegistry.connect(owner).removeFee(tokens[1].address, weth.address)).to.be.revertedWith(
			'Cannot remove pool fee'
		)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to remove fee: not owner', async function () {
		await expect(
			uniswapRegistry.connect(trader).removeFee(tokens[1].address, tokens[2].address)
		).to.be.revertedWith('Ownable: caller is not the owner')
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should remove fee', async function () {
		await uniswapRegistry.connect(owner).removeFee(tokens[1].address, tokens[2].address)

		await expect(uniswapRegistry.getFee(tokens[1].address, tokens[2].address)).to.be.revertedWith(
			'Pair fee not registered'
		)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fail to remove fee: no fee to remove', async function () {
		await expect(uniswapRegistry.connect(owner).removeFee(tokens[1].address, tokens[2].address)).to.be.revertedWith(
			'No fee to remove'
		)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should batch add fees', async function () {
		await uniswapRegistry.connect(owner).batchAddFees([tokens[1].address], [tokens[2].address], [UNI_V3_FEE])

		const fee = await uniswapRegistry.getFee(tokens[1].address, tokens[2].address)
		expect(BigNumber.from(fee).eq(UNI_V3_FEE)).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})
})
