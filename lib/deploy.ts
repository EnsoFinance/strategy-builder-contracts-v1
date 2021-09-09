import hre from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract } from 'ethers'
import {
		encodePriceSqrt,
		getDeadline,
		getMinTick,
		getMaxTick,
		ITEM_CATEGORY,
		ESTIMATOR_CATEGORY,
		UNI_V3_FEE,
		ORACLE_TIME_WINDOW
} from './utils'

import Strategy from '../artifacts/contracts/Strategy.sol/Strategy.json'
import StrategyController from '../artifacts/contracts/StrategyController.sol/StrategyController.json'
import StrategyControllerAdmin from '../artifacts/contracts/StrategyControllerAdmin.sol/StrategyControllerAdmin.json'
import StrategyProxyFactory from '../artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json'
import StrategyProxyFactoryAdmin from '../artifacts/contracts/StrategyProxyFactoryAdmin.sol/StrategyProxyFactoryAdmin.json'
import EnsoOracle from '../artifacts/contracts/oracles/EnsoOracle.sol/EnsoOracle.json'
import UniswapNaiveOracle from '../artifacts/contracts/oracles/protocols/UniswapNaiveOracle.sol/UniswapNaiveOracle.json'
import ChainlinkOracle from '../artifacts/contracts/oracles/protocols/ChainlinkOracle.sol/ChainlinkOracle.json'
import AaveEstimator from '../artifacts/contracts/oracles/estimators/AaveEstimator.sol/AaveEstimator.json'
import AaveDebtEstimator from '../artifacts/contracts/oracles/estimators/AaveDebtEstimator.sol/AaveDebtEstimator.json'
import BasicEstimator from '../artifacts/contracts/oracles/estimators/BasicEstimator.sol/BasicEstimator.json'
import CompoundEstimator from '../artifacts/contracts/oracles/estimators/CompoundEstimator.sol/CompoundEstimator.json'
import CurveEstimator from '../artifacts/contracts/oracles/estimators/CurveEstimator.sol/CurveEstimator.json'
import CurveGaugeEstimator from '../artifacts/contracts/oracles/estimators/CurveGaugeEstimator.sol/CurveGaugeEstimator.json'
import StrategyEstimator from '../artifacts/contracts/oracles/estimators/StrategyEstimator.sol/StrategyEstimator.json'
import SynthEstimator from '../artifacts/contracts/oracles/estimators/SynthEstimator.sol/SynthEstimator.json'
import UniswapV2Estimator from '../artifacts/contracts/oracles/estimators/UniswapV2Estimator.sol/UniswapV2Estimator.json'
import YEarnV2Estimator from '../artifacts/contracts/oracles/estimators/YEarnV2Estimator.sol/YEarnV2Estimator.json'
import TokenRegistry from '../artifacts/contracts/oracles/registries/TokenRegistry.sol/TokenRegistry.json'
import CurvePoolRegistry from '../artifacts/contracts/oracles/registries/CurvePoolRegistry.sol/CurvePoolRegistry.json'
import UniswapV3Registry from '../artifacts/contracts/oracles/registries/UniswapV3Registry.sol/UniswapV3Registry.json'
import Whitelist from '../artifacts/contracts/Whitelist.sol/Whitelist.json'
import LoopRouter from '../artifacts/contracts/routers/LoopRouter.sol/LoopRouter.json'
import FullRouter from '../artifacts/contracts/routers/FullRouter.sol/FullRouter.json'
import BatchDepositRouter from '../artifacts/contracts/routers/BatchDepositRouter.sol/BatchDepositRouter.json'
import GenericRouter from '../artifacts/contracts/routers/GenericRouter.sol/GenericRouter.json'
import UniswapV2Adapter from '../artifacts/contracts/adapters/UniswapV2Adapter.sol/UniswapV2Adapter.json'
import UniswapV3Adapter from '../artifacts/contracts/adapters/UniswapV3Adapter.sol/UniswapV3Adapter.json'
import MetaStrategyAdapter from '../artifacts/contracts/adapters/MetaStrategyAdapter.sol/MetaStrategyAdapter.json'
import AaveLendAdapter from '../artifacts/contracts/adapters/AaveLendAdapter.sol/AaveLendAdapter.json'
import AaveBorrowAdapter from '../artifacts/contracts/adapters/AaveBorrowAdapter.sol/AaveBorrowAdapter.json'
import CompoundAdapter from '../artifacts/contracts/adapters/CompoundAdapter.sol/CompoundAdapter.json'
import CurveAdapter from '../artifacts/contracts/adapters/CurveAdapter.sol/CurveAdapter.json'
import CurveLPAdapter from '../artifacts/contracts/adapters/CurveLPAdapter.sol/CurveLPAdapter.json'
import CurveRewardsAdapter from '../artifacts/contracts/adapters/CurveRewardsAdapter.sol/CurveRewardsAdapter.json'
import SynthetixAdapter from '../artifacts/contracts/adapters/SynthetixAdapter.sol/SynthetixAdapter.json'
import YEarnV2Adapter from '../artifacts/contracts/adapters/YEarnV2Adapter.sol/YEarnV2Adapter.json'
import BalancerAdapter from '../artifacts/contracts/adapters/BalancerAdapter.sol/BalancerAdapter.json'
import BalancerFactory from '../artifacts/contracts/test/Balancer.sol/Balancer.json'
import BalancerRegistry from '../artifacts/contracts/test/BalancerRegistry.sol/BalancerRegistry.json'
import BPool from '../artifacts/@balancer-labs/core/contracts/BPool.sol/BPool.json'

import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'
import UniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import NFTDescriptor from '@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json'
import NonfungiblePositionManager from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
//import NonfungibleTokenPositionDescriptor from '../artifacts/contracts/test/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json'

const { ethers, waffle } = hre
const { constants, getContractFactory } = ethers
const { WeiPerEther, AddressZero } = constants

export type Oracles = {
	ensoOracle: Contract
	protocols: {
		uniswapOracle: Contract
		chainlinkOracle: Contract
	}
	registries: {
		tokenRegistry: Contract
		curvePoolRegistry: Contract
		uniswapV3Registry: Contract
	}
}

export type Administration = {
	whitelist: Contract,
	controllerAdmin: Contract,
	factoryAdmin: Contract
}

export class Platform {
	strategyFactory: Contract
	controller: Contract
	oracles: Oracles
	administration: Administration

	public constructor(
		strategyFactory: Contract,
		controller: Contract,
		oracles: Oracles,
		administration: Administration
	) {
		this.strategyFactory = strategyFactory
		this.controller = controller
		this.oracles = oracles
		this.administration = administration
	}

	print() {
		console.log('Enso Platform: ')
		console.log('  Factory: ', this.strategyFactory.address)
		console.log('  Controller: ', this.controller.address)
		console.log('  Whitelist: ', this.administration.whitelist.address)
		console.log('  Oracle: ', this.oracles.ensoOracle.address)
		console.log('  TokenRegistry: ', this.oracles.registries.tokenRegistry.address)
	}
}

export async function deployTokens(owner: SignerWithAddress, numTokens: number, value: BigNumber): Promise<Contract[]> {
	const tokens: Contract[] = []
	for (let i = 0; i < numTokens; i++) {
		if (i === 0) {
			const token = await waffle.deployContract(owner, WETH9)
			await token.deposit({ value: value })
			tokens.push(token)
		} else {
			const token = await waffle.deployContract(owner, ERC20, [WeiPerEther.mul(10000)])
			tokens.push(token)
		}
	}
	return tokens
}

export async function deployBalancer(owner: SignerWithAddress, tokens: Contract[]): Promise<[Contract, Contract]> {
	const balancerFactory = await waffle.deployContract(owner, BalancerFactory, [])
	await balancerFactory.deployed()

	const balancerRegistry = await waffle.deployContract(owner, BalancerRegistry, [balancerFactory.address])
	await balancerRegistry.deployed()

	for (let i = 0; i < tokens.length; i++) {
		if (i !== 0) {
			const tx = await balancerFactory.newBPool()
			const receipt = await tx.wait()
			if (
				receipt.events === undefined ||
				receipt.events[0].args === undefined ||
				receipt.events[0].args.pool === undefined
			) {
				throw new Error('deployBalancer() -> Failed to find pool arg in newBPool() event')
			}
			const poolAddress = receipt.events[0].args.pool
			const pool = new Contract(
		    poolAddress,
		    BPool.abi,
		    owner
		  )
			await tokens[0].approve(poolAddress, WeiPerEther.mul(100))
			await tokens[i].approve(poolAddress, WeiPerEther.mul(100))
			await pool.bind(tokens[0].address, WeiPerEther.mul(100), WeiPerEther.mul(5))
			await pool.bind(tokens[i].address, WeiPerEther.mul(100), WeiPerEther.mul(5))
			await pool.finalize()
			await balancerRegistry.addPoolPair(poolAddress, tokens[0].address, tokens[i].address)
			await balancerRegistry.sortPools([tokens[0].address, tokens[i].address], BigNumber.from(3))
		}
	}
	return [balancerFactory, balancerRegistry]
}

export async function deployBalancerAdapter(owner: SignerWithAddress, balancerRegistry: Contract, weth: Contract) {
	const adapter = await waffle.deployContract(owner, BalancerAdapter, [balancerRegistry.address, weth.address])
	await adapter.deployed()
	return adapter
}

export async function deployUniswapV2(owner: SignerWithAddress, tokens: Contract[]): Promise<Contract> {
	const uniswapFactory = await waffle.deployContract(owner, UniswapV2Factory, [owner.address])
	await uniswapFactory.deployed()
	const liquidityAmount = WeiPerEther.mul(100)
	//console.log('Uniswap factory: ', uniswapFactory.address)
	for (let i = 1; i < tokens.length; i++) {
		//tokens[0] is used as the trading pair (WETH)
		await uniswapFactory.createPair(tokens[0].address, tokens[i].address)
		const pairAddress = await uniswapFactory.getPair(tokens[0].address, tokens[i].address)
		const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), owner)

		// Add liquidity
		await tokens[0].connect(owner).transfer(pairAddress, liquidityAmount)
		await tokens[i].connect(owner).transfer(pairAddress, liquidityAmount)
		await pair.connect(owner).mint(owner.address)
	}
	return uniswapFactory
}
// deployUniswapV3: async (owner, tokens) => {
export async function deployUniswapV3(owner: SignerWithAddress, tokens: Contract[]) {
	const uniswapFactory = await waffle.deployContract(owner, UniswapV3Factory)
	await uniswapFactory.deployed()

	const nftDesciptor = await waffle.deployContract(owner, NFTDescriptor, [])
	const UniswapNFTDescriptor = await getContractFactory('NonfungibleTokenPositionDescriptor', {
		libraries: {
			NFTDescriptor: nftDesciptor.address
		}
	})
	const uniswapNFTDescriptor = await UniswapNFTDescriptor.connect(owner).deploy(tokens[0].address)
	await uniswapNFTDescriptor.deployed()
	//const uniswapNFTDescriptor = await waffle.deployContract(owner, NonfungibleTokenPositionDescriptor, [tokens[0].address])
	const uniswapNFTManager = await waffle.deployContract(owner, NonfungiblePositionManager, [uniswapFactory.address, tokens[0].address, uniswapNFTDescriptor.address])

	await tokens[0].connect(owner).approve(uniswapNFTManager.address, constants.MaxUint256)
	for (let i = 1; i < tokens.length; i++) {
		const aNum = ethers.BigNumber.from(tokens[0].address)
		const bNum = ethers.BigNumber.from(tokens[i].address)
		const flipper = aNum.lt(bNum)

		//tokens[0] is used as the trading pair (WETH)
		await uniswapNFTManager.createAndInitializePoolIfNecessary(
			flipper ? tokens[0].address : tokens[i].address,
			flipper ? tokens[i].address : tokens[0].address,
			UNI_V3_FEE,
			encodePriceSqrt(1, 1)
	  )
		// Add liquidity
		await tokens[i].connect(owner).approve(uniswapNFTManager.address, constants.MaxUint256)

		await uniswapNFTManager.mint({
			token0: flipper ? tokens[0].address : tokens[i].address,
			token1: flipper ? tokens[i].address : tokens[0].address,
			tickLower: getMinTick(60),
			tickUpper: getMaxTick(60),
			fee: UNI_V3_FEE,
			recipient: owner.address,
			amount0Desired: WeiPerEther.mul(100),
			amount1Desired: WeiPerEther.mul(100),
			amount0Min: 0,
			amount1Min: 0,
			deadline: getDeadline(240),
	  })
	}

	return [uniswapFactory, uniswapNFTManager]
}

export async function deployPlatform(
	owner: SignerWithAddress,
	uniswapFactory: Contract,
	weth: Contract,
	susd?: Contract
): Promise<Platform> {
	// Setup Oracle infrastructure - registries, estimators, protocol oracles
	const tokenRegistry = await waffle.deployContract(owner, TokenRegistry, [])
	await tokenRegistry.deployed()
	const curvePoolRegistry = await waffle.deployContract(owner, CurvePoolRegistry, [])
	await curvePoolRegistry.deployed()
	const uniswapV3Registry = await waffle.deployContract(owner, UniswapV3Registry, [ORACLE_TIME_WINDOW, uniswapFactory.address, weth.address])
	await uniswapV3Registry.deployed()

	const basicEstimator = await waffle.deployContract(owner, BasicEstimator, [])
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.BASIC, basicEstimator.address)
	const aaveEstimator = await waffle.deployContract(owner, AaveEstimator, [])
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.AAVE, aaveEstimator.address)
	const aaveDebtEstimator = await waffle.deployContract(owner, AaveDebtEstimator, [])
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.AAVE_DEBT, aaveDebtEstimator.address)
	const compoundEstimator = await waffle.deployContract(owner, CompoundEstimator, [])
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.COMPOUND, compoundEstimator.address)
	const curveEstimator = await waffle.deployContract(owner, CurveEstimator, [curvePoolRegistry.address])
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.CURVE, curveEstimator.address)
	const curveGaugeEstimator = await waffle.deployContract(owner, CurveGaugeEstimator, [])
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.CURVE_GAUGE, curveGaugeEstimator.address)
	const synthEstimator = await waffle.deployContract(owner, SynthEstimator, [])
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.SYNTH, synthEstimator.address)
	const strategyEstimator = await waffle.deployContract(owner, StrategyEstimator, [])
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.STRATEGY, strategyEstimator.address)
	const uniswapV2Estimator = await waffle.deployContract(owner, UniswapV2Estimator, [])
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.UNISWAP_V2, uniswapV2Estimator.address)
	const yearnV2Estimator = await waffle.deployContract(owner, YEarnV2Estimator, [])
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.YEARN_V2, yearnV2Estimator.address)

	await tokenRegistry.connect(owner).addItem(ITEM_CATEGORY.RESERVE, ESTIMATOR_CATEGORY.BASIC, weth.address)
	if (susd) await tokenRegistry.connect(owner).addItem(ITEM_CATEGORY.RESERVE, ESTIMATOR_CATEGORY.SYNTH, susd.address)

	const uniswapOracle = await waffle.deployContract(owner, UniswapNaiveOracle, [uniswapFactory.address, weth.address])
	await uniswapOracle.deployed()

	const chainlinkOracle = await waffle.deployContract(owner, ChainlinkOracle, [weth.address])
	await chainlinkOracle.deployed()

	const ensoOracle = await waffle.deployContract(owner, EnsoOracle, [tokenRegistry.address, uniswapOracle.address, chainlinkOracle.address, weth.address, susd?.address || AddressZero])
	await ensoOracle.deployed()

	// Whitelist
	const whitelist = await waffle.deployContract(owner, Whitelist, [])
	await whitelist.deployed()

	// Strategy Implementation
	const strategyImplementation = await waffle.deployContract(owner, Strategy, [])
	await strategyImplementation.deployed()

	// Factory
	const factoryAdmin = await waffle.deployContract(owner, StrategyProxyFactoryAdmin, [
		strategyImplementation.address,
		ensoOracle.address,
		tokenRegistry.address,
		whitelist.address
	])
	await factoryAdmin.deployed()

	const factoryAddress = await factoryAdmin.factory()
	const strategyFactory = new Contract(
    factoryAddress,
    StrategyProxyFactory.abi,
    owner
  )

	// Strategy Controller
	const controllerAdmin = await waffle.deployContract(owner, StrategyControllerAdmin, [factoryAddress])
	await controllerAdmin.deployed()

	const controllerAddress = await controllerAdmin.controller()
	const controller = new Contract(
    controllerAddress,
    StrategyController.abi,
    owner
  )

	await strategyFactory.connect(owner).setController(controllerAddress)
	await tokenRegistry.connect(owner).transferOwnership(factoryAddress);

	const oracles: Oracles = {
		ensoOracle,
		protocols: {
			uniswapOracle,
			chainlinkOracle
		},
		registries: {
			tokenRegistry,
			curvePoolRegistry,
			uniswapV3Registry
		}
	}

	const administration: Administration = {
		whitelist,
		controllerAdmin,
		factoryAdmin
	}

	return new Platform(strategyFactory, controller, oracles, administration)
}

export async function deployUniswapV2Adapter(owner: SignerWithAddress, uniswapFactory: Contract, weth: Contract): Promise<Contract> {
	const adapter = await waffle.deployContract(owner, UniswapV2Adapter, [uniswapFactory.address, weth.address])
	await adapter.deployed()
	return adapter
}

export async function deployUniswapV3Adapter(owner: SignerWithAddress, uniswapRegistry: Contract, uniswapFactory: Contract, weth: Contract): Promise<Contract> {
	const adapter = await waffle.deployContract(owner, UniswapV3Adapter, [uniswapRegistry.address, uniswapFactory.address, weth.address])
	await adapter.deployed()
	return adapter
}

export async function deployMetaStrategyAdapter(
	owner: SignerWithAddress,
	router: Contract,
	weth: Contract
) {
	const adapter = await waffle.deployContract(owner, MetaStrategyAdapter, [router.address, weth.address])
	await adapter.deployed()
	return adapter
}

export async function deployAaveLendAdapter(
	owner: SignerWithAddress,
	lendingPool: Contract,
	strategyController: Contract,
	weth: Contract
) {
	const adapter = await waffle.deployContract(owner, AaveLendAdapter, [lendingPool.address, strategyController.address, weth.address])
	await adapter.deployed()
	return adapter
}

export async function deployAaveBorrowAdapter(
	owner: SignerWithAddress,
	lendingPool: Contract,
	weth: Contract
) {
	const adapter = await waffle.deployContract(owner, AaveBorrowAdapter, [lendingPool.address, weth.address])
	await adapter.deployed()
	return adapter
}

export async function deployCompoundAdapter(
	owner: SignerWithAddress,
	comptroller: Contract,
	weth: Contract
) {
	const adapter = await waffle.deployContract(owner, CompoundAdapter, [comptroller.address, weth.address])
	await adapter.deployed()
	return adapter
}

export async function deployYEarnAdapter(
	owner: SignerWithAddress,
	weth: Contract
) {
	const adapter = await waffle.deployContract(owner, YEarnV2Adapter, [weth.address])
	await adapter.deployed()
	return adapter
}

export async function deployCurveAdapter(
	owner: SignerWithAddress,
	curvePoolRegistry: Contract,
	weth: Contract
) {
	const adapter = await waffle.deployContract(owner, CurveAdapter, [
			curvePoolRegistry.address,
			weth.address
	])
	await adapter.deployed()
	return adapter
}

export async function deployCurveLPAdapter(
	owner: SignerWithAddress,
	curvePoolRegistry: Contract,
	weth: Contract
) {
	const adapter = await waffle.deployContract(owner, CurveLPAdapter, [
			curvePoolRegistry.address,
			weth.address
	])
	await adapter.deployed()
	return adapter
}

export async function deployCurveRewardsAdapter(
	owner: SignerWithAddress,
	curvePoolRegistry: Contract,
	weth: Contract
) {
	const adapter = await waffle.deployContract(owner, CurveRewardsAdapter, [
			curvePoolRegistry.address,
			weth.address
	])
	await adapter.deployed()
	return adapter
}

export async function deploySynthetixAdapter(
	owner: SignerWithAddress,
	resolver: Contract,
	weth: Contract
) {
	const adapter = await waffle.deployContract(owner, SynthetixAdapter, [
			resolver.address,
			weth.address
	])
	await adapter.deployed()
	return adapter
}

export async function deployLoopRouter(
	owner: SignerWithAddress,
	controller: Contract,
) {
	const router = await waffle.deployContract(owner, LoopRouter, [controller.address])
	await router.deployed()

	return router
}

export async function deployFullRouter(
	owner: SignerWithAddress,
	controller: Contract,
) {
	const router = await waffle.deployContract(owner, FullRouter, [controller.address])
	await router.deployed()

	return router
}

export async function deployBatchDepositRouter(
	owner: SignerWithAddress,
	controller: Contract,
) {
	const router = await waffle.deployContract(owner, BatchDepositRouter, [controller.address])
	await router.deployed()

	return router
}

export async function deployGenericRouter(
	owner: SignerWithAddress,
	controller: Contract
) {
	const router = await waffle.deployContract(owner, GenericRouter, [controller.address])
	await router.deployed()

	return router
}