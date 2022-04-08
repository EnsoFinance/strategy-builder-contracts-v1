"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployMulticallRouter = exports.deployBatchDepositRouter = exports.deployFullRouter = exports.deployLoopRouter = exports.deployLeverage2XAdapter = exports.deploySynthetixAdapter = exports.deployCurveGaugeAdapter = exports.deployCurveLPAdapter = exports.deployCurveAdapter = exports.deployYEarnAdapter = exports.deployCompoundAdapter = exports.deployAaveV2DebtAdapter = exports.deployAaveV2Adapter = exports.deployMetaStrategyAdapter = exports.deployUniswapV3Adapter = exports.deployUniswapV2LPAdapter = exports.deployEnsoStakingAdapter = exports.deployUniswapV2Adapter = exports.deployStakedEnsoEstimator = exports.deployEnsoEstimator = exports.deployEnsoToken = exports.deployPlatform = exports.deployUniswapV3 = exports.deployUniswapV2 = exports.deployBalancerAdapter = exports.deployBalancer = exports.deployTokens = exports.Platform = void 0;
var hardhat_1 = __importDefault(require("hardhat"));
var ethers_1 = require("ethers");
var utils_1 = require("./utils");
var link_1 = require("./link");
var PlatformProxyAdmin_json_1 = __importDefault(require("../artifacts/contracts/PlatformProxyAdmin.sol/PlatformProxyAdmin.json"));
var Strategy_json_1 = __importDefault(require("../artifacts/contracts/Strategy.sol/Strategy.json"));
var StrategyController_json_1 = __importDefault(require("../artifacts/contracts/StrategyController.sol/StrategyController.json"));
var StrategyProxyFactory_json_1 = __importDefault(require("../artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json"));
var StrategyLibrary_json_1 = __importDefault(require("../artifacts/contracts/libraries/StrategyLibrary.sol/StrategyLibrary.json"));
var EnsoOracle_json_1 = __importDefault(require("../artifacts/contracts/oracles/EnsoOracle.sol/EnsoOracle.json"));
var UniswapNaiveOracle_json_1 = __importDefault(require("../artifacts/contracts/test/UniswapNaiveOracle.sol/UniswapNaiveOracle.json"));
var UniswapV3Oracle_json_1 = __importDefault(require("../artifacts/contracts/oracles/protocols/UniswapV3Oracle.sol/UniswapV3Oracle.json"));
var ChainlinkOracle_json_1 = __importDefault(require("../artifacts/contracts/oracles/protocols/ChainlinkOracle.sol/ChainlinkOracle.json"));
var AaveV2Estimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/AaveV2Estimator.sol/AaveV2Estimator.json"));
var AaveV2DebtEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/AaveV2DebtEstimator.sol/AaveV2DebtEstimator.json"));
var BasicEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/BasicEstimator.sol/BasicEstimator.json"));
var EnsoEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/EnsoEstimator.sol/EnsoEstimator.json"));
var StakedEnsoEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/StakedEnsoEstimator.sol/StakedEnsoEstimator.json"));
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
var EnsoStakingAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/staking/EnsoStakingAdapter.sol/EnsoStakingAdapter.json"));
var UniswapV2Adapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/exchanges/UniswapV2Adapter.sol/UniswapV2Adapter.json"));
var UniswapV2LPAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/liquidity/UniswapV2LPAdapter.sol/UniswapV2LPAdapter.json"));
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
var Balancer_json_1 = __importDefault(require("../artifacts/contracts/test/Balancer.sol/Balancer.json"));
var BalancerRegistry_json_1 = __importDefault(require("../artifacts/contracts/test/BalancerRegistry.sol/BalancerRegistry.json"));
var BPool_json_1 = __importDefault(require("../artifacts/@balancer-labs/core/contracts/BPool.sol/BPool.json"));
var Enso_json_1 = __importDefault(require("@ensofinance/erc20/artifacts/contracts/Enso.sol/Enso.json"));
var ERC20_json_1 = __importDefault(require("@uniswap/v2-periphery/build/ERC20.json"));
var WETH9_json_1 = __importDefault(require("@uniswap/v2-periphery/build/WETH9.json"));
var UniswapV2Factory_json_1 = __importDefault(require("@uniswap/v2-core/build/UniswapV2Factory.json"));
var UniswapV2Pair_json_1 = __importDefault(require("@uniswap/v2-core/build/UniswapV2Pair.json"));
var UniswapV3Factory_json_1 = __importDefault(require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"));
var NFTDescriptor_json_1 = __importDefault(require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"));
var NonfungiblePositionManager_json_1 = __importDefault(require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"));
var constants_1 = require("./constants");
var ethers = hardhat_1.default.ethers, waffle = hardhat_1.default.waffle;
var constants = ethers.constants, getContractFactory = ethers.getContractFactory;
var WeiPerEther = constants.WeiPerEther, AddressZero = constants.AddressZero;
var Platform = /** @class */ (function () {
    function Platform(strategyFactory, controller, oracles, administration, library) {
        this.strategyFactory = strategyFactory;
        this.controller = controller;
        this.oracles = oracles;
        this.administration = administration;
        this.library = library;
    }
    Platform.prototype.print = function () {
        console.log('Enso Platform: ');
        console.log('  Factory: ', this.strategyFactory.address);
        console.log('  Controller: ', this.controller.address);
        console.log('  Whitelist: ', this.administration.whitelist.address);
        console.log('  Oracle: ', this.oracles.ensoOracle.address);
        console.log('  TokenRegistry: ', this.oracles.registries.tokenRegistry.address);
    };
    return Platform;
}());
exports.Platform = Platform;
function deployTokens(owner, numTokens, value) {
    return __awaiter(this, void 0, void 0, function () {
        var tokens, i, token, token;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tokens = [];
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < numTokens)) return [3 /*break*/, 7];
                    if (!(i === 0)) return [3 /*break*/, 4];
                    return [4 /*yield*/, waffle.deployContract(owner, WETH9_json_1.default)];
                case 2:
                    token = _a.sent();
                    return [4 /*yield*/, token.deposit({ value: value })];
                case 3:
                    _a.sent();
                    tokens.push(token);
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, waffle.deployContract(owner, ERC20_json_1.default, [WeiPerEther.mul(10000)])];
                case 5:
                    token = _a.sent();
                    tokens.push(token);
                    _a.label = 6;
                case 6:
                    i++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, tokens];
            }
        });
    });
}
exports.deployTokens = deployTokens;
function deployBalancer(owner, tokens) {
    return __awaiter(this, void 0, void 0, function () {
        var balancerFactory, balancerRegistry, i, tx, receipt, poolAddress, pool;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, Balancer_json_1.default, [])];
                case 1:
                    balancerFactory = _a.sent();
                    return [4 /*yield*/, balancerFactory.deployed()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, BalancerRegistry_json_1.default, [balancerFactory.address])];
                case 3:
                    balancerRegistry = _a.sent();
                    return [4 /*yield*/, balancerRegistry.deployed()];
                case 4:
                    _a.sent();
                    i = 0;
                    _a.label = 5;
                case 5:
                    if (!(i < tokens.length)) return [3 /*break*/, 16];
                    if (!(i !== 0)) return [3 /*break*/, 15];
                    return [4 /*yield*/, balancerFactory.newBPool()];
                case 6:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 7:
                    receipt = _a.sent();
                    if (receipt.events === undefined ||
                        receipt.events[0].args === undefined ||
                        receipt.events[0].args.pool === undefined) {
                        throw new Error('deployBalancer() -> Failed to find pool arg in newBPool() event');
                    }
                    poolAddress = receipt.events[0].args.pool;
                    pool = new ethers_1.Contract(poolAddress, BPool_json_1.default.abi, owner);
                    return [4 /*yield*/, tokens[0].approve(poolAddress, WeiPerEther.mul(100))];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, tokens[i].approve(poolAddress, WeiPerEther.mul(100))];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, pool.bind(tokens[0].address, WeiPerEther.mul(100), WeiPerEther.mul(5))];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, pool.bind(tokens[i].address, WeiPerEther.mul(100), WeiPerEther.mul(5))];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, pool.finalize()];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, balancerRegistry.addPoolPair(poolAddress, tokens[0].address, tokens[i].address)];
                case 13:
                    _a.sent();
                    return [4 /*yield*/, balancerRegistry.sortPools([tokens[0].address, tokens[i].address], ethers_1.BigNumber.from(3))];
                case 14:
                    _a.sent();
                    _a.label = 15;
                case 15:
                    i++;
                    return [3 /*break*/, 5];
                case 16: return [2 /*return*/, [balancerFactory, balancerRegistry]];
            }
        });
    });
}
exports.deployBalancer = deployBalancer;
function deployBalancerAdapter(owner, balancerRegistry, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, BalancerAdapter_json_1.default, [balancerRegistry.address, weth.address])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployBalancerAdapter = deployBalancerAdapter;
function deployUniswapV2(owner, tokens) {
    return __awaiter(this, void 0, void 0, function () {
        var uniswapV2Factory, liquidityAmount, i, pairAddress, pair;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, UniswapV2Factory_json_1.default, [owner.address])];
                case 1:
                    uniswapV2Factory = _a.sent();
                    return [4 /*yield*/, uniswapV2Factory.deployed()];
                case 2:
                    _a.sent();
                    liquidityAmount = WeiPerEther.mul(100);
                    i = 1;
                    _a.label = 3;
                case 3:
                    if (!(i < tokens.length)) return [3 /*break*/, 10];
                    //tokens[0] is used as the trading pair (WETH)
                    return [4 /*yield*/, uniswapV2Factory.createPair(tokens[0].address, tokens[i].address)];
                case 4:
                    //tokens[0] is used as the trading pair (WETH)
                    _a.sent();
                    return [4 /*yield*/, uniswapV2Factory.getPair(tokens[0].address, tokens[i].address)];
                case 5:
                    pairAddress = _a.sent();
                    pair = new ethers_1.Contract(pairAddress, JSON.stringify(UniswapV2Pair_json_1.default.abi), owner);
                    // Add liquidity
                    return [4 /*yield*/, tokens[0].connect(owner).transfer(pairAddress, liquidityAmount)];
                case 6:
                    // Add liquidity
                    _a.sent();
                    return [4 /*yield*/, tokens[i].connect(owner).transfer(pairAddress, liquidityAmount)];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, pair.connect(owner).mint(owner.address)];
                case 8:
                    _a.sent();
                    _a.label = 9;
                case 9:
                    i++;
                    return [3 /*break*/, 3];
                case 10: return [2 /*return*/, uniswapV2Factory];
            }
        });
    });
}
exports.deployUniswapV2 = deployUniswapV2;
// deployUniswapV3: async (owner, tokens) => {
function deployUniswapV3(owner, tokens) {
    return __awaiter(this, void 0, void 0, function () {
        var uniswapV3Factory, nftDesciptor, UniswapNFTDescriptor, uniswapNFTDescriptor, uniswapNFTManager, i, aNum, bNum, flipper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, UniswapV3Factory_json_1.default)];
                case 1:
                    uniswapV3Factory = _a.sent();
                    return [4 /*yield*/, uniswapV3Factory.deployed()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, NFTDescriptor_json_1.default, [])];
                case 3:
                    nftDesciptor = _a.sent();
                    return [4 /*yield*/, getContractFactory('NonfungibleTokenPositionDescriptor', {
                            libraries: {
                                NFTDescriptor: nftDesciptor.address
                            }
                        })];
                case 4:
                    UniswapNFTDescriptor = _a.sent();
                    return [4 /*yield*/, UniswapNFTDescriptor.connect(owner).deploy(tokens[0].address)];
                case 5:
                    uniswapNFTDescriptor = _a.sent();
                    return [4 /*yield*/, uniswapNFTDescriptor.deployed()
                        //const uniswapNFTDescriptor = await waffle.deployContract(owner, NonfungibleTokenPositionDescriptor, [tokens[0].address])
                    ];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, NonfungiblePositionManager_json_1.default, [uniswapV3Factory.address, tokens[0].address, uniswapNFTDescriptor.address])];
                case 7:
                    uniswapNFTManager = _a.sent();
                    return [4 /*yield*/, tokens[0].connect(owner).approve(uniswapNFTManager.address, constants.MaxUint256)];
                case 8:
                    _a.sent();
                    i = 1;
                    _a.label = 9;
                case 9:
                    if (!(i < tokens.length)) return [3 /*break*/, 14];
                    aNum = ethers.BigNumber.from(tokens[0].address);
                    bNum = ethers.BigNumber.from(tokens[i].address);
                    flipper = aNum.lt(bNum);
                    //tokens[0] is used as the trading pair (WETH)
                    return [4 /*yield*/, uniswapNFTManager.createAndInitializePoolIfNecessary(flipper ? tokens[0].address : tokens[i].address, flipper ? tokens[i].address : tokens[0].address, constants_1.UNI_V3_FEE, utils_1.encodePriceSqrt(1, 1))
                        // Add liquidity
                    ];
                case 10:
                    //tokens[0] is used as the trading pair (WETH)
                    _a.sent();
                    // Add liquidity
                    return [4 /*yield*/, tokens[i].connect(owner).approve(uniswapNFTManager.address, constants.MaxUint256)];
                case 11:
                    // Add liquidity
                    _a.sent();
                    return [4 /*yield*/, uniswapNFTManager.mint({
                            token0: flipper ? tokens[0].address : tokens[i].address,
                            token1: flipper ? tokens[i].address : tokens[0].address,
                            tickLower: utils_1.getMinTick(60),
                            tickUpper: utils_1.getMaxTick(60),
                            fee: constants_1.UNI_V3_FEE,
                            recipient: owner.address,
                            amount0Desired: WeiPerEther.mul(100),
                            amount1Desired: WeiPerEther.mul(100),
                            amount0Min: 0,
                            amount1Min: 0,
                            deadline: utils_1.getDeadline(240),
                        })];
                case 12:
                    _a.sent();
                    _a.label = 13;
                case 13:
                    i++;
                    return [3 /*break*/, 9];
                case 14: return [2 /*return*/, [uniswapV3Factory, uniswapNFTManager]];
            }
        });
    });
}
exports.deployUniswapV3 = deployUniswapV3;
function deployPlatform(owner, uniswapOracleFactory, uniswapV3Factory, weth, susd, feePool) {
    return __awaiter(this, void 0, void 0, function () {
        var strategyLibrary, strategyLibraryLink, tokenRegistry, curveDepositZapRegistry, uniswapV3Registry, chainlinkRegistry, uniswapOracle, chainlinkOracle, ensoOracle, defaultEstimator, chainlinkEstimator, strategyEstimator, emergencyEstimator, aaveV2Estimator, aaveV2DebtEstimator, compoundEstimator, curveLPEstimator, curveGaugeEstimator, uniswapV2LPEstimator, yearnV2Estimator, whitelist, platformProxyAdmin, controllerAddress, factoryAddress, controllerImplementation, factoryImplementation, strategyImplementation, factory, controller, oracles, administration;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, StrategyLibrary_json_1.default, [])];
                case 1:
                    strategyLibrary = _a.sent();
                    return [4 /*yield*/, strategyLibrary.deployed()];
                case 2:
                    _a.sent();
                    strategyLibraryLink = link_1.createLink(StrategyLibrary_json_1.default, strategyLibrary.address);
                    return [4 /*yield*/, waffle.deployContract(owner, TokenRegistry_json_1.default, [])];
                case 3:
                    tokenRegistry = _a.sent();
                    return [4 /*yield*/, tokenRegistry.deployed()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, CurveDepositZapRegistry_json_1.default, [])];
                case 5:
                    curveDepositZapRegistry = _a.sent();
                    return [4 /*yield*/, curveDepositZapRegistry.deployed()];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, UniswapV3Registry_json_1.default, [constants_1.ORACLE_TIME_WINDOW, uniswapV3Factory.address, weth.address])];
                case 7:
                    uniswapV3Registry = _a.sent();
                    return [4 /*yield*/, uniswapV3Registry.deployed()];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, ChainlinkRegistry_json_1.default, [])];
                case 9:
                    chainlinkRegistry = _a.sent();
                    return [4 /*yield*/, chainlinkRegistry.deployed()];
                case 10:
                    _a.sent();
                    if (!(uniswapOracleFactory.address == uniswapV3Factory.address)) return [3 /*break*/, 12];
                    return [4 /*yield*/, waffle.deployContract(owner, UniswapV3Oracle_json_1.default, [uniswapV3Registry.address, weth.address])];
                case 11:
                    uniswapOracle = _a.sent();
                    return [3 /*break*/, 14];
                case 12: return [4 /*yield*/, waffle.deployContract(owner, UniswapNaiveOracle_json_1.default, [uniswapOracleFactory.address, weth.address])];
                case 13:
                    uniswapOracle = _a.sent();
                    _a.label = 14;
                case 14: return [4 /*yield*/, uniswapOracle.deployed()
                    /* TODO switch to this approach once we setup registry script
                    let uniswapOracle: Contract, uniswapV3Registry: Contract;
                    if (uniswapFactory.address === MAINNET_ADDRESSES.UNISWAP_V3_FACTORY) {
                        uniswapV3Registry = await waffle.deployContract(owner, UniswapV3Registry, [ORACLE_TIME_WINDOW, uniswapFactory.address, weth.address])
                        await uniswapV3Registry.deployed()
                        uniswapOracle = await waffle.deployContract(owner, UniswapV3Oracle, [uniswapV3Registry.address, weth.address])
                    } else {
                        uniswapOracle = await waffle.deployContract(owner, UniswapNaiveOracle, [uniswapFactory.address, weth.address])
                    }
                    await uniswapOracle.deployed()
                    */
                ];
                case 15:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, ChainlinkOracle_json_1.default, [chainlinkRegistry.address, weth.address])];
                case 16:
                    chainlinkOracle = _a.sent();
                    return [4 /*yield*/, chainlinkOracle.deployed()];
                case 17:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, EnsoOracle_json_1.default, [tokenRegistry.address, weth.address, (susd === null || susd === void 0 ? void 0 : susd.address) || AddressZero])];
                case 18:
                    ensoOracle = _a.sent();
                    return [4 /*yield*/, ensoOracle.deployed()];
                case 19:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, BasicEstimator_json_1.default, [uniswapOracle.address])];
                case 20:
                    defaultEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(constants_1.ESTIMATOR_CATEGORY.DEFAULT_ORACLE, defaultEstimator.address)];
                case 21:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, BasicEstimator_json_1.default, [chainlinkOracle.address])];
                case 22:
                    chainlinkEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(constants_1.ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, chainlinkEstimator.address)];
                case 23:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, StrategyEstimator_json_1.default, [])];
                case 24:
                    strategyEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(constants_1.ESTIMATOR_CATEGORY.STRATEGY, strategyEstimator.address)];
                case 25:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, EmergencyEstimator_json_1.default, [])];
                case 26:
                    emergencyEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(constants_1.ESTIMATOR_CATEGORY.BLOCKED, emergencyEstimator.address)];
                case 27:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, AaveV2Estimator_json_1.default, [])];
                case 28:
                    aaveV2Estimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(constants_1.ESTIMATOR_CATEGORY.AAVE_V2, aaveV2Estimator.address)];
                case 29:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, AaveV2DebtEstimator_json_1.default, [])];
                case 30:
                    aaveV2DebtEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(constants_1.ESTIMATOR_CATEGORY.AAVE_V2_DEBT, aaveV2DebtEstimator.address)];
                case 31:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, CompoundEstimator_json_1.default, [])];
                case 32:
                    compoundEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(constants_1.ESTIMATOR_CATEGORY.COMPOUND, compoundEstimator.address)];
                case 33:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, CurveLPEstimator_json_1.default, [])];
                case 34:
                    curveLPEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(constants_1.ESTIMATOR_CATEGORY.CURVE_LP, curveLPEstimator.address)];
                case 35:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, CurveGaugeEstimator_json_1.default, [])];
                case 36:
                    curveGaugeEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(constants_1.ESTIMATOR_CATEGORY.CURVE_GAUGE, curveGaugeEstimator.address)];
                case 37:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, UniswapV2LPEstimator_json_1.default, [])];
                case 38:
                    uniswapV2LPEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(constants_1.ESTIMATOR_CATEGORY.UNISWAP_V2_LP, uniswapV2LPEstimator.address)];
                case 39:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, YEarnV2Estimator_json_1.default, [])];
                case 40:
                    yearnV2Estimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(constants_1.ESTIMATOR_CATEGORY.YEARN_V2, yearnV2Estimator.address)];
                case 41:
                    _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addItem(constants_1.ITEM_CATEGORY.RESERVE, constants_1.ESTIMATOR_CATEGORY.DEFAULT_ORACLE, weth.address)];
                case 42:
                    _a.sent();
                    if (!susd) return [3 /*break*/, 44];
                    return [4 /*yield*/, tokenRegistry.connect(owner).addItem(constants_1.ITEM_CATEGORY.RESERVE, constants_1.ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, susd.address)
                        // Whitelist
                    ];
                case 43:
                    _a.sent();
                    _a.label = 44;
                case 44: return [4 /*yield*/, waffle.deployContract(owner, Whitelist_json_1.default, [])];
                case 45:
                    whitelist = _a.sent();
                    return [4 /*yield*/, whitelist.deployed()
                        // Deploy Platfrom Admin and get controller and factory addresses
                    ];
                case 46:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, PlatformProxyAdmin_json_1.default, [])];
                case 47:
                    platformProxyAdmin = _a.sent();
                    return [4 /*yield*/, platformProxyAdmin.deployed()];
                case 48:
                    _a.sent();
                    return [4 /*yield*/, platformProxyAdmin.controller()];
                case 49:
                    controllerAddress = _a.sent();
                    return [4 /*yield*/, platformProxyAdmin.factory()
                        // Controller Implementation
                    ];
                case 50:
                    factoryAddress = _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, link_1.linkBytecode(StrategyController_json_1.default, [strategyLibraryLink]), [factoryAddress])];
                case 51:
                    controllerImplementation = _a.sent();
                    return [4 /*yield*/, controllerImplementation.deployed()
                        // Factory Implementation
                    ];
                case 52:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, StrategyProxyFactory_json_1.default, [controllerAddress])];
                case 53:
                    factoryImplementation = _a.sent();
                    return [4 /*yield*/, factoryImplementation.deployed()
                        // Strategy Implementation
                    ];
                case 54:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, Strategy_json_1.default, [
                            factoryAddress,
                            controllerAddress,
                            constants_1.MAINNET_ADDRESSES.SYNTHETIX_ADDRESS_PROVIDER,
                            constants_1.MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER
                        ])];
                case 55:
                    strategyImplementation = _a.sent();
                    return [4 /*yield*/, strategyImplementation.deployed()];
                case 56:
                    _a.sent();
                    return [4 /*yield*/, platformProxyAdmin.connect(owner).initialize(controllerImplementation.address, factoryImplementation.address, strategyImplementation.address, ensoOracle.address, tokenRegistry.address, whitelist.address, feePool || owner.address)
                        // Factory
                    ];
                case 57:
                    _a.sent();
                    factory = new ethers_1.Contract(factoryAddress, StrategyProxyFactory_json_1.default.abi, owner);
                    controller = new ethers_1.Contract(controllerAddress, StrategyController_json_1.default.abi, owner);
                    return [4 /*yield*/, tokenRegistry.connect(owner).transferOwnership(factoryAddress)];
                case 58:
                    _a.sent();
                    oracles = {
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
                    administration = {
                        whitelist: whitelist,
                        platformProxyAdmin: platformProxyAdmin
                    };
                    return [2 /*return*/, new Platform(factory, controller, oracles, administration, strategyLibrary)];
            }
        });
    });
}
exports.deployPlatform = deployPlatform;
function deployEnsoToken(owner, minter, name, symbol, mintingAllowedAfter) {
    return __awaiter(this, void 0, void 0, function () {
        var ensoToken;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, Enso_json_1.default, [name, symbol, minter.address, mintingAllowedAfter])];
                case 1:
                    ensoToken = _a.sent();
                    return [4 /*yield*/, ensoToken.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, ensoToken];
            }
        });
    });
}
exports.deployEnsoToken = deployEnsoToken;
function deployEnsoEstimator(owner, sEnso, defaultEstimator, strategyFactory) {
    return __awaiter(this, void 0, void 0, function () {
        var ensoEstimator;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, EnsoEstimator_json_1.default, [sEnso.address, defaultEstimator.address])];
                case 1:
                    ensoEstimator = _a.sent();
                    return [4 /*yield*/, strategyFactory.connect(owner).addEstimatorToRegistry(constants_1.ESTIMATOR_CATEGORY.ENSO, ensoEstimator.address)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, ensoEstimator];
            }
        });
    });
}
exports.deployEnsoEstimator = deployEnsoEstimator;
function deployStakedEnsoEstimator(owner, strategyFactory) {
    return __awaiter(this, void 0, void 0, function () {
        var stakedEnsoEstimator;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, StakedEnsoEstimator_json_1.default, [])];
                case 1:
                    stakedEnsoEstimator = _a.sent();
                    return [4 /*yield*/, strategyFactory.connect(owner).addEstimatorToRegistry(constants_1.ESTIMATOR_CATEGORY.ENSO_STAKED, stakedEnsoEstimator.address)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, stakedEnsoEstimator];
            }
        });
    });
}
exports.deployStakedEnsoEstimator = deployStakedEnsoEstimator;
function deployUniswapV2Adapter(owner, uniswapV2Factory, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, UniswapV2Adapter_json_1.default, [uniswapV2Factory.address, weth.address])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployUniswapV2Adapter = deployUniswapV2Adapter;
function deployEnsoStakingAdapter(owner, staking, stakingToken, distributionToken, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, EnsoStakingAdapter_json_1.default, [staking.address, stakingToken.address, distributionToken.address, weth.address])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployEnsoStakingAdapter = deployEnsoStakingAdapter;
function deployUniswapV2LPAdapter(owner, uniswapV2Factory, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, UniswapV2LPAdapter_json_1.default, [uniswapV2Factory.address, weth.address])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployUniswapV2LPAdapter = deployUniswapV2LPAdapter;
function deployUniswapV3Adapter(owner, uniswapRegistry, uniswapRouter, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, UniswapV3Adapter_json_1.default, [uniswapRegistry.address, uniswapRouter.address, weth.address])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployUniswapV3Adapter = deployUniswapV3Adapter;
function deployMetaStrategyAdapter(owner, controller, router, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, MetaStrategyAdapter_json_1.default, [controller.address, router.address, weth.address])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployMetaStrategyAdapter = deployMetaStrategyAdapter;
function deployAaveV2Adapter(owner, addressProvider, strategyController, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, AaveV2Adapter_json_1.default, [addressProvider.address, strategyController.address, weth.address])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployAaveV2Adapter = deployAaveV2Adapter;
function deployAaveV2DebtAdapter(owner, addressProvider, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, AaveV2DebtAdapter_json_1.default, [addressProvider.address, weth.address])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployAaveV2DebtAdapter = deployAaveV2DebtAdapter;
function deployCompoundAdapter(owner, comptroller, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, CompoundAdapter_json_1.default, [comptroller.address, weth.address])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployCompoundAdapter = deployCompoundAdapter;
function deployYEarnAdapter(owner, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, YEarnV2Adapter_json_1.default, [weth.address])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployYEarnAdapter = deployYEarnAdapter;
function deployCurveAdapter(owner, curveAddressProvider, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, CurveAdapter_json_1.default, [
                        curveAddressProvider.address,
                        weth.address
                    ])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployCurveAdapter = deployCurveAdapter;
function deployCurveLPAdapter(owner, curveAddressProvider, curveDepositZapRegistry, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, CurveLPAdapter_json_1.default, [
                        curveAddressProvider.address,
                        curveDepositZapRegistry.address,
                        weth.address
                    ])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployCurveLPAdapter = deployCurveLPAdapter;
function deployCurveGaugeAdapter(owner, curveAddressProvider, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, CurveGaugeAdapter_json_1.default, [
                        curveAddressProvider.address,
                        weth.address
                    ])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployCurveGaugeAdapter = deployCurveGaugeAdapter;
function deploySynthetixAdapter(owner, resolver, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, SynthetixAdapter_json_1.default, [
                        resolver.address,
                        weth.address
                    ])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deploySynthetixAdapter = deploySynthetixAdapter;
function deployLeverage2XAdapter(owner, defaultAdapter, aaveV2Adapter, aaveV2DebtAdapter, debtToken, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, Leverage2XAdapter_json_1.default, [
                        defaultAdapter.address,
                        aaveV2Adapter.address,
                        aaveV2DebtAdapter.address,
                        debtToken.address,
                        weth.address
                    ])];
                case 1:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployLeverage2XAdapter = deployLeverage2XAdapter;
function deployLoopRouter(owner, controller, library) {
    return __awaiter(this, void 0, void 0, function () {
        var router;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, link_1.linkBytecode(LoopRouter_json_1.default, [link_1.createLink(StrategyLibrary_json_1.default, library.address)]), [controller.address])];
                case 1:
                    router = _a.sent();
                    return [4 /*yield*/, router.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, router];
            }
        });
    });
}
exports.deployLoopRouter = deployLoopRouter;
function deployFullRouter(owner, addressProvider, controller, library) {
    return __awaiter(this, void 0, void 0, function () {
        var router;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, link_1.linkBytecode(FullRouter_json_1.default, [link_1.createLink(StrategyLibrary_json_1.default, library.address)]), [addressProvider.address, controller.address])];
                case 1:
                    router = _a.sent();
                    return [4 /*yield*/, router.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, router];
            }
        });
    });
}
exports.deployFullRouter = deployFullRouter;
function deployBatchDepositRouter(owner, controller, library) {
    return __awaiter(this, void 0, void 0, function () {
        var router;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, link_1.linkBytecode(BatchDepositRouter_json_1.default, [link_1.createLink(StrategyLibrary_json_1.default, library.address)]), [controller.address])];
                case 1:
                    router = _a.sent();
                    return [4 /*yield*/, router.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, router];
            }
        });
    });
}
exports.deployBatchDepositRouter = deployBatchDepositRouter;
function deployMulticallRouter(owner, controller) {
    return __awaiter(this, void 0, void 0, function () {
        var router;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, MulticallRouter_json_1.default, [controller.address])];
                case 1:
                    router = _a.sent();
                    return [4 /*yield*/, router.deployed()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, router];
            }
        });
    });
}
exports.deployMulticallRouter = deployMulticallRouter;
