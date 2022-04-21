"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLiveContracts = exports.liveRouters = exports.liveAdapters = exports.livePlatform = exports.liveEstimators = exports.RouterTypes = exports.AdapterTypes = exports.LiveEnvironment = void 0;
var ethers_1 = require("ethers");
var deploy_1 = require("./deploy");
var deployments_json_1 = __importDefault(require("../deployments.json"));
var PlatformProxyAdmin_json_1 = __importDefault(require("../artifacts/contracts/PlatformProxyAdmin.sol/PlatformProxyAdmin.json"));
// import Strategy from '../artifacts/contracts/Strategy.sol/Strategy.json'
var StrategyController_json_1 = __importDefault(require("../artifacts/contracts/StrategyController.sol/StrategyController.json"));
var StrategyProxyFactory_json_1 = __importDefault(require("../artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json"));
var StrategyLibrary_json_1 = __importDefault(require("../artifacts/contracts/libraries/StrategyLibrary.sol/StrategyLibrary.json"));
var EnsoOracle_json_1 = __importDefault(require("../artifacts/contracts/oracles/EnsoOracle.sol/EnsoOracle.json"));
var UniswapV3Oracle_json_1 = __importDefault(require("../artifacts/contracts/oracles/protocols/UniswapV3Oracle.sol/UniswapV3Oracle.json"));
var ChainlinkOracle_json_1 = __importDefault(require("../artifacts/contracts/oracles/protocols/ChainlinkOracle.sol/ChainlinkOracle.json"));
var AaveV2Estimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/AaveV2Estimator.sol/AaveV2Estimator.json"));
var AaveV2DebtEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/AaveV2DebtEstimator.sol/AaveV2DebtEstimator.json"));
var BasicEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/BasicEstimator.sol/BasicEstimator.json"));
var DefaultEstimator = BasicEstimator_json_1.default;
// import EnsoEstimator from '../artifacts/contracts/oracles/estimators/EnsoEstimator.sol/EnsoEstimator.json'
// import StakedEnsoEstimator from '../artifacts/contracts/oracles/estimators/StakedEnsoEstimator.sol/StakedEnsoEstimator.json'
var CompoundEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/CompoundEstimator.sol/CompoundEstimator.json"));
var CurveLPEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/CurveLPEstimator.sol/CurveLPEstimator.json"));
var CurveGaugeEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/CurveGaugeEstimator.sol/CurveGaugeEstimator.json"));
var EmergencyEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/EmergencyEstimator.sol/EmergencyEstimator.json"));
var StrategyEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/StrategyEstimator.sol/StrategyEstimator.json"));
var UniswapV2LPEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/UniswapV2LPEstimator.sol/UniswapV2LPEstimator.json"));
var YEarnV2Estimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/YEarnV2Estimator.sol/YEarnV2Estimator.json"));
var TokenRegistry_json_1 = __importDefault(require("../artifacts/contracts/oracles/registries/TokenRegistry.sol/TokenRegistry.json"));
var CurveDepositZapRegistry_json_1 = __importDefault(require("../artifacts/contracts/oracles/registries/CurveDepositZapRegistry.sol/CurveDepositZapRegistry.json"));
var UniswapV3Registry_json_1 = __importDefault(require("../artifacts/contracts/oracles/registries/UniswapV3Registry.sol/UniswapV3Registry.json"));
var ChainlinkRegistry_json_1 = __importDefault(require("../artifacts/contracts/oracles/registries/ChainlinkRegistry.sol/ChainlinkRegistry.json"));
var Whitelist_json_1 = __importDefault(require("../artifacts/contracts/Whitelist.sol/Whitelist.json"));
var LoopRouter_json_1 = __importDefault(require("../artifacts/contracts/routers/LoopRouter.sol/LoopRouter.json"));
var FullRouter_json_1 = __importDefault(require("../artifacts/contracts/routers/FullRouter.sol/FullRouter.json"));
var BatchDepositRouter_json_1 = __importDefault(require("../artifacts/contracts/routers/BatchDepositRouter.sol/BatchDepositRouter.json"));
var MulticallRouter_json_1 = __importDefault(require("../artifacts/contracts/routers/MulticallRouter.sol/MulticallRouter.json"));
// import EnsoStakingAdapter from '../artifacts/contracts/adapters/staking/EnsoStakingAdapter.sol/EnsoStakingAdapter.json'
var UniswapV2Adapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/exchanges/UniswapV2Adapter.sol/UniswapV2Adapter.json"));
// import UniswapV2LPAdapter from '../artifacts/contracts/adapters/liquidity/UniswapV2LPAdapter.sol/UniswapV2LPAdapter.json'
var UniswapV3Adapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/exchanges/UniswapV3Adapter.sol/UniswapV3Adapter.json"));
var MetaStrategyAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/strategy/MetaStrategyAdapter.sol/MetaStrategyAdapter.json"));
var AaveV2Adapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/lending/AaveV2Adapter.sol/AaveV2Adapter.json"));
var AaveV2DebtAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/borrow/AaveV2DebtAdapter.sol/AaveV2DebtAdapter.json"));
var CompoundAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/lending/CompoundAdapter.sol/CompoundAdapter.json"));
var CurveAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/exchanges/CurveAdapter.sol/CurveAdapter.json"));
var CurveLPAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/liquidity/CurveLPAdapter.sol/CurveLPAdapter.json"));
var CurveGaugeAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/vaults/CurveGaugeAdapter.sol/CurveGaugeAdapter.json"));
var Leverage2XAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/borrow/Leverage2XAdapter.sol/Leverage2XAdapter.json"));
var SynthetixAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/exchanges/SynthetixAdapter.sol/SynthetixAdapter.json"));
var YEarnV2Adapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/vaults/YEarnV2Adapter.sol/YEarnV2Adapter.json"));
var BalancerAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/exchanges/BalancerAdapter.sol/BalancerAdapter.json"));
var AddressZero = ethers_1.constants.AddressZero;
var LiveEnvironment = /** @class */ (function () {
    function LiveEnvironment(signer, platform, adapters, routers, estimators) {
        this.signer = signer;
        this.platform = platform;
        this.adapters = adapters;
        this.routers = routers;
        this.estimators = estimators;
    }
    return LiveEnvironment;
}());
exports.LiveEnvironment = LiveEnvironment;
var AdapterTypes;
(function (AdapterTypes) {
    AdapterTypes["AaveV2"] = "aavev2";
    AdapterTypes["AaveV2Debt"] = "aavev2debt";
    AdapterTypes["Balancer"] = "balancer";
    AdapterTypes["Compound"] = "compound";
    AdapterTypes["Curve"] = "curve";
    AdapterTypes["CurveLP"] = "curvelp";
    AdapterTypes["CurveGauge"] = "curvegauge";
    AdapterTypes["Leverage"] = "leverage";
    AdapterTypes["MetaStrategy"] = "metastrategy";
    AdapterTypes["Synthetix"] = "synthetix";
    AdapterTypes["UniswapV2LP"] = "uniswapv2lp";
    AdapterTypes["UniswapV2"] = "uniswapv2";
    AdapterTypes["UniswapV3"] = "uniswapv3";
    AdapterTypes["YEarnV2"] = "yearnv2";
})(AdapterTypes = exports.AdapterTypes || (exports.AdapterTypes = {}));
var RouterTypes;
(function (RouterTypes) {
    RouterTypes["Multicall"] = "multicall";
    RouterTypes["Loop"] = "loop";
    RouterTypes["Full"] = "full";
    RouterTypes["Batch"] = "batch";
})(RouterTypes = exports.RouterTypes || (exports.RouterTypes = {}));
function liveEstimators(signer) {
    if (!deployments_json_1.default.mainnet)
        throw Error("Deployment addresses not found");
    var addrs = deployments_json_1.default.mainnet;
    var defaultEstimator = new ethers_1.Contract(addrs.DefaultEstimator, DefaultEstimator.abi, signer);
    var chainlink = new ethers_1.Contract(addrs.ChainlinkOracle, DefaultEstimator.abi, signer);
    var strategy = new ethers_1.Contract(addrs.StrategyEstimator, StrategyEstimator_json_1.default.abi, signer);
    var emergency = new ethers_1.Contract(addrs.EmergencyEstimator, EmergencyEstimator_json_1.default.abi, signer);
    var aaveV2 = new ethers_1.Contract(addrs.AaveV2Estimator, AaveV2Estimator_json_1.default.abi, signer);
    var aaveV2Debt = new ethers_1.Contract(addrs.AaveV2DebtEstimator, AaveV2DebtEstimator_json_1.default.abi, signer);
    var compound = new ethers_1.Contract(addrs.CompoundEstimator, CompoundEstimator_json_1.default.abi, signer);
    var curveLP = new ethers_1.Contract(addrs.CurveLPEstimator, CurveLPEstimator_json_1.default.abi, signer);
    var curveGauge = new ethers_1.Contract(addrs.CurveGaugeEstimator, CurveGaugeEstimator_json_1.default.abi, signer);
    var uniswapV2LP = new ethers_1.Contract(addrs.UniswapV2LPEstimator, UniswapV2LPEstimator_json_1.default.abi, signer);
    var yearnV2 = new ethers_1.Contract(addrs.YEarnV2Estimator, YEarnV2Estimator_json_1.default.abi, signer);
    var estimators = {
        defaultEstimator: defaultEstimator,
        chainlink: chainlink,
        strategy: strategy,
        emergency: emergency,
        aaveV2: aaveV2,
        aaveV2Debt: aaveV2Debt,
        compound: compound,
        curveLP: curveLP,
        curveGauge: curveGauge,
        uniswapV2LP: uniswapV2LP,
        yearnV2: yearnV2
    };
    return estimators;
}
exports.liveEstimators = liveEstimators;
function livePlatform(signer) {
    if (!deployments_json_1.default.mainnet)
        throw Error("Deployment addresses not found");
    var addrs = deployments_json_1.default.mainnet;
    var strategyLibrary = new ethers_1.Contract(addrs.StrategyLibrary, StrategyLibrary_json_1.default.abi, signer);
    var tokenRegistry = new ethers_1.Contract(addrs.TokenRegistry, TokenRegistry_json_1.default.abi, signer);
    var curveDepositZapRegistry = new ethers_1.Contract(addrs.CurveDepositZapRegistry, CurveDepositZapRegistry_json_1.default.abi, signer);
    var uniswapV3Registry = new ethers_1.Contract(addrs.UniswapV3Registry, UniswapV3Registry_json_1.default.abi, signer);
    var chainlinkRegistry = new ethers_1.Contract(addrs.ChainlinkRegistry, ChainlinkRegistry_json_1.default.abi, signer);
    var uniswapOracle = new ethers_1.Contract(addrs.UniswapOracle, UniswapV3Oracle_json_1.default.abi, signer);
    var chainlinkOracle = new ethers_1.Contract(addrs.ChainlinkOracle, ChainlinkOracle_json_1.default.abi, signer);
    var ensoOracle = new ethers_1.Contract(addrs.EnsoOracle, EnsoOracle_json_1.default.abi, signer);
    var whitelist = new ethers_1.Contract(addrs.Whitelist, Whitelist_json_1.default.abi, signer);
    var platformProxyAdmin = new ethers_1.Contract(addrs.PlatformProxyAdmin, PlatformProxyAdmin_json_1.default.abi, signer);
    var controller = new ethers_1.Contract(addrs.StrategyController, StrategyController_json_1.default.abi, signer);
    var factory = new ethers_1.Contract(addrs.StrategyProxyFactory, StrategyProxyFactory_json_1.default.abi, signer);
    // const strategy = new Contract(addrs.Strategy, Strategy.abi, signer)
    // Oracles
    var oracles = {
        ensoOracle: ensoOracle,
        protocols: {
            uniswapOracle: uniswapOracle,
            chainlinkOracle: chainlinkOracle
        },
        registries: {
            tokenRegistry: tokenRegistry,
            curveDepositZapRegistry: curveDepositZapRegistry,
            uniswapV3Registry: uniswapV3Registry,
            chainlinkRegistry: chainlinkRegistry
        }
    };
    // Admin
    var administration = {
        whitelist: whitelist,
        platformProxyAdmin: platformProxyAdmin
    };
    return new deploy_1.Platform(factory, controller, oracles, administration, strategyLibrary);
}
exports.livePlatform = livePlatform;
function liveAdapters(signer) {
    var addrs = deployments_json_1.default.mainnet;
    var aaveV2 = new ethers_1.Contract(addrs.AaveV2Adapter, AaveV2Adapter_json_1.default.abi, signer);
    var aaveV2Debt = new ethers_1.Contract(addrs.AaveV2DebtAdapter, AaveV2DebtAdapter_json_1.default.abi, signer);
    var balancer = new ethers_1.Contract(addrs.BalancerAdapter, BalancerAdapter_json_1.default.abi, signer);
    var compound = new ethers_1.Contract(addrs.CompoundAdapter, CompoundAdapter_json_1.default.abi, signer);
    var curve = new ethers_1.Contract(addrs.CurveAdapter, CurveAdapter_json_1.default.abi, signer);
    var curveLP = new ethers_1.Contract(addrs.CurveLPAdapter, CurveLPAdapter_json_1.default.abi, signer);
    var curveGauge = new ethers_1.Contract(addrs.CurveGaugeAdapter, CurveGaugeAdapter_json_1.default.abi, signer);
    var leverage = new ethers_1.Contract(addrs.Leverage2XAdapter, Leverage2XAdapter_json_1.default.abi, signer);
    var synthetix = new ethers_1.Contract(addrs.SynthetixAdapter, SynthetixAdapter_json_1.default.abi, signer);
    var metastrategy = new ethers_1.Contract(addrs.MetaStrategyAdapter, MetaStrategyAdapter_json_1.default.abi, signer);
    // TODO: this is not deployed live
    // const uniswapV2LP = new Contract(addrs.UniswapV2LP, UniswapV2LPAdapter.abi, signer)
    var uniswapV2LP = new ethers_1.Contract(AddressZero, [], signer.provider);
    var uniswapV2 = new ethers_1.Contract(addrs.UniswapV2Adapter, UniswapV2Adapter_json_1.default.abi, signer);
    var uniswapV3 = new ethers_1.Contract(addrs.UniswapV3Adapter, UniswapV3Adapter_json_1.default.abi, signer);
    var yearnV2 = new ethers_1.Contract(addrs.YEarnV2Adapter, YEarnV2Adapter_json_1.default.abi, signer);
    var liveAdapters = {
        aaveV2: aaveV2,
        aaveV2Debt: aaveV2Debt,
        balancer: balancer,
        compound: compound,
        curve: curve,
        curveLP: curveLP,
        curveGauge: curveGauge,
        leverage: leverage,
        synthetix: synthetix,
        metastrategy: metastrategy,
        uniswapV2LP: uniswapV2LP,
        uniswapV2: uniswapV2,
        uniswapV3: uniswapV3,
        yearnV2: yearnV2
    };
    return liveAdapters;
}
exports.liveAdapters = liveAdapters;
function liveRouters(signer) {
    if (!deployments_json_1.default.mainnet)
        throw Error("Deployment addresses not found");
    var addrs = deployments_json_1.default.mainnet;
    var multicall = new ethers_1.Contract(addrs.MulticallRouter, MulticallRouter_json_1.default.abi, signer);
    var loop = new ethers_1.Contract(addrs.LoopRouter, LoopRouter_json_1.default.abi, signer);
    var full = new ethers_1.Contract(addrs.FullRouter, FullRouter_json_1.default.abi, signer);
    var batch = new ethers_1.Contract(addrs.BatchDepositRouter, BatchDepositRouter_json_1.default.abi, signer);
    var routers = {
        multicall: multicall,
        loop: loop,
        full: full,
        batch: batch
    };
    return routers;
}
exports.liveRouters = liveRouters;
function getLiveContracts(signer) {
    var platform = livePlatform(signer);
    var adapters = liveAdapters(signer);
    var routers = liveRouters(signer);
    var estimators = liveEstimators(signer);
    var liveContracts = {
        signer: signer,
        platform: platform,
        adapters: adapters,
        routers: routers,
        estimators: estimators
    };
    return liveContracts;
}
exports.getLiveContracts = getLiveContracts;
