import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, constants } from 'ethers'
import { Platform, Administration, Oracles } from './deploy'
import deployments from '../deployments.json'

import PlatformProxyAdmin from '../artifacts/contracts/PlatformProxyAdmin.sol/PlatformProxyAdmin.json'
// import Strategy from '../artifacts/contracts/Strategy.sol/Strategy.json'
import StrategyController from '../artifacts/contracts/StrategyController.sol/StrategyController.json'
import StrategyProxyFactory from '../artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json'
import StrategyLibrary from '../artifacts/contracts/libraries/StrategyLibrary.sol/StrategyLibrary.json'
import EnsoOracle from '../artifacts/contracts/oracles/EnsoOracle.sol/EnsoOracle.json'
import UniswapV3Oracle from '../artifacts/contracts/oracles/protocols/UniswapV3Oracle.sol/UniswapV3Oracle.json'
import ChainlinkOracle from '../artifacts/contracts/oracles/protocols/ChainlinkOracle.sol/ChainlinkOracle.json'
import AaveV2Estimator from '../artifacts/contracts/oracles/estimators/AaveV2Estimator.sol/AaveV2Estimator.json'
import AaveV2DebtEstimator from '../artifacts/contracts/oracles/estimators/AaveV2DebtEstimator.sol/AaveV2DebtEstimator.json'
import BasicEstimator from '../artifacts/contracts/oracles/estimators/BasicEstimator.sol/BasicEstimator.json'
const DefaultEstimator = BasicEstimator
import CompoundEstimator from '../artifacts/contracts/oracles/estimators/CompoundEstimator.sol/CompoundEstimator.json'
import CurveLPEstimator from '../artifacts/contracts/oracles/estimators/CurveLPEstimator.sol/CurveLPEstimator.json'
import CurveGaugeEstimator from '../artifacts/contracts/oracles/estimators/CurveGaugeEstimator.sol/CurveGaugeEstimator.json'
import EmergencyEstimator from '../artifacts/contracts/oracles/estimators/EmergencyEstimator.sol/EmergencyEstimator.json'
import StrategyEstimator from '../artifacts/contracts/oracles/estimators/StrategyEstimator.sol/StrategyEstimator.json'
import YEarnV2Estimator from '../artifacts/contracts/oracles/estimators/YEarnV2Estimator.sol/YEarnV2Estimator.json'
import TokenRegistry from '../artifacts/contracts/oracles/registries/TokenRegistry.sol/TokenRegistry.json'
import CurveDepositZapRegistry from '../artifacts/contracts/oracles/registries/CurveDepositZapRegistry.sol/CurveDepositZapRegistry.json'
import UniswapV3Registry from '../artifacts/contracts/oracles/registries/UniswapV3Registry.sol/UniswapV3Registry.json'
import ChainlinkRegistry from '../artifacts/contracts/oracles/registries/ChainlinkRegistry.sol/ChainlinkRegistry.json'
import Whitelist from '../artifacts/contracts/Whitelist.sol/Whitelist.json'
import LoopRouter from '../artifacts/contracts/routers/LoopRouter.sol/LoopRouter.json'
import FullRouter from '../artifacts/contracts/routers/FullRouter.sol/FullRouter.json'
import BatchDepositRouter from '../artifacts/contracts/routers/BatchDepositRouter.sol/BatchDepositRouter.json'
import MulticallRouter from '../artifacts/contracts/routers/MulticallRouter.sol/MulticallRouter.json'
import UniswapV2Adapter from '../artifacts/contracts/adapters/exchanges/UniswapV2Adapter.sol/UniswapV2Adapter.json'
import UniswapV3Adapter from '../artifacts/contracts/adapters/exchanges/UniswapV3Adapter.sol/UniswapV3Adapter.json'
import MetaStrategyAdapter from '../artifacts/contracts/adapters/strategy/MetaStrategyAdapter.sol/MetaStrategyAdapter.json'
import AaveV2Adapter from '../artifacts/contracts/adapters/lending/AaveV2Adapter.sol/AaveV2Adapter.json'
import AaveV2DebtAdapter from '../artifacts/contracts/adapters/borrow/AaveV2DebtAdapter.sol/AaveV2DebtAdapter.json'
import CompoundAdapter from '../artifacts/contracts/adapters/lending/CompoundAdapter.sol/CompoundAdapter.json'
import CurveAdapter from '../artifacts/contracts/adapters/exchanges/CurveAdapter.sol/CurveAdapter.json'
import CurveLPAdapter from '../artifacts/contracts/adapters/liquidity/CurveLPAdapter.sol/CurveLPAdapter.json'
import CurveGaugeAdapter from '../artifacts/contracts/adapters/vaults/CurveGaugeAdapter.sol/CurveGaugeAdapter.json'
import SynthetixAdapter from '../artifacts/contracts/adapters/exchanges/SynthetixAdapter.sol/SynthetixAdapter.json'
import YEarnV2Adapter from '../artifacts/contracts/adapters/vaults/YEarnV2Adapter.sol/YEarnV2Adapter.json'
const { AddressZero } = constants

export class LiveEnvironment {
	signer: SignerWithAddress
	platform: Platform
	adapters: LiveAdapters
	routers: LiveRouters
    estimators: Estimators

	constructor(
		signer: SignerWithAddress,
		platform: Platform,
		adapters: LiveAdapters,
		routers: LiveRouters,
        estimators: Estimators,
	) {
		this.signer = signer
		this.platform = platform
		this.adapters = adapters
		this.routers = routers
        this.estimators = estimators
	}
}


export type LiveAdapters = {
	aaveV2: Contract
    aaveV2Debt: Contract
	balancer: Contract
	compound: Contract
	curve: Contract
	curveLP: Contract
	curveGauge: Contract
	leverage: Contract
	synthetix: Contract
	metastrategy: Contract
	uniswapV2: Contract
	uniswapV3: Contract
	yearnV2: Contract
}

export enum AdapterTypes {
	AaveV2 = 'aavev2',
	AaveV2Debt = 'aavev2debt',
	Balancer = 'balancer',
	Compound = 'compound',
	Curve = 'curve',
	CurveLP = 'curvelp',
	CurveGauge = 'curvegauge',
	Leverage = 'leverage',
	MetaStrategy = 'metastrategy',
	Synthetix = 'synthetix',
	UniswapV2 = 'uniswapv2',
	UniswapV3 = 'uniswapv3',
	YEarnV2 = 'yearnv2'
}

export enum RouterTypes {
	Multicall = 'multicall',
	Loop = 'loop',
	Full = 'full',
	Batch = 'batch'
}

export type LiveRouters = {
    multicall: Contract
    loop: Contract
    full: Contract
    batch: Contract
}

export type Estimators = {
    defaultEstimator: Contract
    chainlink: Contract
    strategy: Contract
    emergency: Contract
    aaveV2: Contract
    aaveV2Debt: Contract
    compound: Contract
    curveLP: Contract
    curveGauge: Contract
    yearnV2: Contract
}

export function liveEstimators(signer: SignerWithAddress) {
    if (!deployments.mainnet) throw Error("Deployment addresses not found")
    const addrs = deployments.mainnet;
    const defaultEstimator = new Contract(addrs.DefaultEstimator, DefaultEstimator.abi, signer)
    const chainlink = new Contract(addrs.ChainlinkOracle, DefaultEstimator.abi, signer)
    const strategy = new Contract(addrs.StrategyEstimator, StrategyEstimator.abi, signer)
    const emergency = new Contract(addrs.EmergencyEstimator, EmergencyEstimator.abi, signer)
    const aaveV2 = new Contract(addrs.AaveV2Estimator, AaveV2Estimator.abi, signer)
	const aaveV2Debt = new Contract(addrs.AaveV2DebtEstimator, AaveV2DebtEstimator.abi, signer)
    const compound = new Contract(addrs.CompoundEstimator, CompoundEstimator.abi, signer)
	const curveLP = new Contract(addrs.CurveLPEstimator, CurveLPEstimator.abi, signer)
	const curveGauge = new Contract(addrs.CurveGaugeEstimator, CurveGaugeEstimator.abi, signer)
	const yearnV2 = new Contract(addrs.YEarnV2Estimator, YEarnV2Estimator.abi, signer)
    const estimators: Estimators = {
       defaultEstimator,
       chainlink,
       strategy,
       emergency,
       aaveV2,
       aaveV2Debt,
       compound,
       curveLP,
       curveGauge,
       yearnV2

    }
    return estimators
}



export function livePlatform(signer: SignerWithAddress): Platform {
    if (!deployments.mainnet) throw Error("Deployment addresses not found")
    const addrs = deployments.mainnet;
    const strategyLibrary =  new Contract(addrs.StrategyLibrary, StrategyLibrary.abi, signer)
    const tokenRegistry = new Contract(addrs.TokenRegistry, TokenRegistry.abi, signer)
    const curveDepositZapRegistry = new Contract(addrs.CurveDepositZapRegistry, CurveDepositZapRegistry.abi, signer)
    const uniswapV3Registry = new Contract(addrs.UniswapV3Registry, UniswapV3Registry.abi, signer)
    const chainlinkRegistry = new Contract(addrs.ChainlinkRegistry, ChainlinkRegistry.abi, signer)
    const uniswapOracle = new Contract(addrs.UniswapOracle, UniswapV3Oracle.abi, signer)
    const chainlinkOracle = new Contract(addrs.ChainlinkOracle, ChainlinkOracle.abi, signer)
    const ensoOracle = new Contract(addrs.EnsoOracle, EnsoOracle.abi, signer)

    const whitelist = new Contract(addrs.Whitelist, Whitelist.abi, signer)
	const platformProxyAdmin = new Contract(addrs.PlatformProxyAdmin, PlatformProxyAdmin.abi, signer)
    const controller = new Contract(addrs.StrategyController, StrategyController.abi, signer)
    const factory = new Contract(addrs.StrategyProxyFactory, StrategyProxyFactory.abi, signer)
    // const strategy = new Contract(addrs.Strategy, Strategy.abi, signer)

    // Oracles
	const oracles: Oracles = {
		ensoOracle,
		protocols: {
			uniswapOracle,
			chainlinkOracle
		},
		registries: {
			tokenRegistry,
			curveDepositZapRegistry,
			uniswapV3Registry,
			chainlinkRegistry
		}
	}

    // Admin
	const administration: Administration = {
		whitelist,
		platformProxyAdmin
	}

	return new Platform(factory, controller, oracles, administration, strategyLibrary)

}

export function liveAdapters(signer: SignerWithAddress): LiveAdapters {
    const addrs = deployments.mainnet;
    const aaveV2 = new Contract(addrs.AaveV2Adapter, AaveV2Adapter.abi, signer)
    const aaveV2Debt = new Contract(addrs.AaveV2DebtAdapter, AaveV2DebtAdapter.abi, signer)
    // TODO: this is not deployed live yet
    // const balancer = new Contract(addrs.BalancerAdapter, BalancerAdapter.abi, signer)
    const balancer = new Contract(AddressZero, [], signer.provider)
    const compound = new Contract(addrs.CompoundAdapter, CompoundAdapter.abi, signer)
    const curve = new Contract(addrs.CurveAdapter, CurveAdapter.abi, signer)
    const curveLP = new Contract(addrs.CurveLPAdapter, CurveLPAdapter.abi, signer)
    const curveGauge = new Contract(addrs.CurveGaugeAdapter, CurveGaugeAdapter.abi, signer)
    // TODO: this is not deployed live yet
    //const leverage = new Contract(addrs.Leverage2XAdapter, Leverage2XAdapter.abi, signer)
    const leverage = new Contract(AddressZero, [], signer.provider)
    const synthetix = new Contract(addrs.SynthetixAdapter, SynthetixAdapter.abi, signer)
    const metastrategy = new Contract(addrs.MetaStrategyAdapter, MetaStrategyAdapter.abi, signer)
    const uniswapV2 = new Contract(addrs.UniswapV2Adapter, UniswapV2Adapter.abi, signer)
    const uniswapV3 = new Contract(addrs.UniswapV3Adapter, UniswapV3Adapter.abi, signer)
    const yearnV2 = new Contract(addrs.YEarnV2Adapter, YEarnV2Adapter.abi, signer)
    const liveAdapters: LiveAdapters = {
        aaveV2,
        aaveV2Debt,
        balancer,
        compound,
        curve,
        curveLP,
        curveGauge,
        leverage,
        synthetix,
        metastrategy,
        uniswapV2,
        uniswapV3,
        yearnV2
    }
    return liveAdapters
}

export function liveRouters(signer: SignerWithAddress): LiveRouters {
    if (!deployments.mainnet) throw Error("Deployment addresses not found")
    const addrs = deployments.mainnet;
    const multicall = new Contract(addrs.MulticallRouter, MulticallRouter.abi, signer)
    const loop = new Contract(addrs.LoopRouter, LoopRouter.abi, signer)
    const full = new Contract(addrs.FullRouter, FullRouter.abi, signer)
    const batch = new Contract(addrs.BatchDepositRouter, BatchDepositRouter.abi, signer)
    const routers: LiveRouters = {
        multicall,
        loop,
        full,
        batch
    }
    return routers
}

export function getLiveContracts(signer: SignerWithAddress): LiveEnvironment {
    const platform = livePlatform(signer);
    const adapters = liveAdapters(signer);
    const routers = liveRouters(signer);
    const estimators = liveEstimators(signer);
    const liveContracts: LiveEnvironment = {
        signer,
        platform,
        adapters,
        routers,
        estimators
    }
    return liveContracts
}
