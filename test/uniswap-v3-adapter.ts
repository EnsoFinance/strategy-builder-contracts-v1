import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
const { expect } = require('chai')

const { ethers, waffle } = require('hardhat')
import { Contract, BigNumber, Event } from 'ethers'
const { deployContract } = waffle
const { constants, getContractFactory, getSigners } = ethers
const { WeiPerEther, AddressZero } = constants
import { deployTokens, deployUniswapV3, deployUniswapV3Adapter, deployLoopRouter } from '../lib/deploy'
import { encodePath, prepareStrategy, Position, StrategyItem, InitialState } from '../lib/encode'
import { increaseTime, getDeadline } from '../lib/utils'
import {  ITEM_CATEGORY, ESTIMATOR_CATEGORY, UNI_V3_FEE, ORACLE_TIME_WINDOW } from '../lib/constants'


import SwapRouter from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'


const NUM_TOKENS = 3

let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		library: Contract,
		uniswapOracle: Contract,
		adapter: Contract,
		router: Contract,
		strategy: Contract,
		wrapper: Contract,
		uniswapRegistry: Contract,
		uniswapV3Factory: Contract,
		uniswapRouter: Contract,
		uniswapQuoter: Contract,
		owner: SignerWithAddress,
		trader: SignerWithAddress,
		strategyItems: StrategyItem[]

async function exactInput(
  tokens: string[],
  amountIn: number,
  amountOutMinimum: number
) {
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

describe('UniswapV3Adapter', function() {
	before('Setup Uniswap V3 + Platform', async function() {
		accounts = await getSigners()
		owner = accounts[5]
		trader = accounts[6]
		// Need to deploy these tokens before WETH to get the correct arrangement of token address where some are bigger and some smaller (for sorting)
		//const token1 = await deployContract(owner, ERC20, [WeiPerEther.mul(10000)])
		//const token2 = await deployContract(owner, ERC20, [WeiPerEther.mul(10000)])
		tokens = await deployTokens(owner, NUM_TOKENS, WeiPerEther.mul(100).mul(NUM_TOKENS - 1))
		//tokens.push(token1)
		//tokens.push(token2)
		weth = tokens[0]

		;[uniswapV3Factory, ] = await deployUniswapV3(owner, tokens)

		uniswapRouter = await deployContract(owner, SwapRouter, [uniswapV3Factory.address, weth.address])

		const UniswapV3Registry = await getContractFactory('UniswapV3Registry')
		uniswapRegistry = await UniswapV3Registry.connect(owner).deploy(ORACLE_TIME_WINDOW, uniswapV3Factory.address, weth.address)
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
		await tokenRegistry.connect(owner).addItem(ITEM_CATEGORY.RESERVE, ESTIMATOR_CATEGORY.DEFAULT_ORACLE, weth.address)

		const EnsoOracle = await getContractFactory('EnsoOracle')
		oracle = await EnsoOracle.connect(owner).deploy(tokenRegistry.address, weth.address, AddressZero)
		await oracle.deployed()

		const Whitelist = await getContractFactory('Whitelist')
		const whitelist = await Whitelist.connect(owner).deploy()
		await whitelist.deployed()

		const StrategyLibrary = await getContractFactory('StrategyLibrary')
		library = await StrategyLibrary.connect(owner).deploy()
		await library.deployed()

		const PlatformProxyAdmin = await getContractFactory('PlatformProxyAdmin')
		const platformProxyAdmin = await PlatformProxyAdmin.connect(owner).deploy()
		await platformProxyAdmin.deployed()
		const controllerAddress = await platformProxyAdmin.controller()
		const factoryAddress = await platformProxyAdmin.factory()

		const StrategyController = await getContractFactory('StrategyController', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		const controllerImplementation = await StrategyController.connect(owner).deploy(factoryAddress)
		await controllerImplementation.deployed()

		const StrategyProxyFactory = await getContractFactory('StrategyProxyFactory')
		const factoryImplementation = await StrategyProxyFactory.connect(owner).deploy(controllerAddress)
		await factoryImplementation.deployed()

		const Strategy = await getContractFactory('Strategy')
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
		controller = await StrategyController.attach(controllerAddress)

		await tokenRegistry.connect(owner).transferOwnership(factoryAddress);

		adapter = await deployUniswapV3Adapter(owner, uniswapRegistry, uniswapRouter, weth)
		await whitelist.connect(owner).approve(adapter.address)

		router = await deployLoopRouter(accounts[0], controller, library)
		await whitelist.connect(owner).approve(router.address)

		uniswapQuoter = await deployContract(trader, Quoter, [uniswapV3Factory.address, weth.address])
	})

	it('Should initialize all tokens', async function() {
		for (let i = 1; i < tokens.length; i++) {
			await uniswapRegistry.addPool(tokens[i].address, weth.address, UNI_V3_FEE)
		}
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) }
		] as Position[]
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

		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				strategyItems,
				strategyState,
				router.address,
				'0x',
				{ value: BigNumber.from('10000000000000000') }
			)
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should swap on uniswap, requiring rebalance', async function() {
		await exactInput([weth.address, tokens[1].address], WeiPerEther.mul(20), 0)
		await increaseTime(60)
	})

	it('Should check oracle price', async function () {
		const quote = await uniswapQuoter.callStatic.quoteExactInput(encodePath([tokens[1].address, weth.address], [UNI_V3_FEE]), WeiPerEther)
		console.log('Quote Price: ', quote.toString())
		const oraclePrice = await uniswapOracle.consult(WeiPerEther, tokens[1].address)
		console.log('Oracle Price: ', oraclePrice.toString())
		expect(oraclePrice.gt(0)).to.equal(true)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should swap on uniswap, requiring rebalance', async function() {
		const balance = await tokens[1].balanceOf(trader.address)
		await exactInput([weth.address, tokens[1].address], balance, 0)
		await increaseTime(60)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})
})
