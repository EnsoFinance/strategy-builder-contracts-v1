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
exports.deployGenericRouter = exports.deployBatchDepositRouter = exports.deployFullRouter = exports.deployLoopRouter = exports.deploySynthetixAdapter = exports.deployCurveRewardsAdapter = exports.deployCurveLPAdapter = exports.deployCurveAdapter = exports.deployYEarnAdapter = exports.deployCompoundAdapter = exports.deployAaveBorrowAdapter = exports.deployAaveLendAdapter = exports.deployMetaStrategyAdapter = exports.deployUniswapV3Adapter = exports.deployUniswapV2Adapter = exports.deployPlatform = exports.deployUniswapV3 = exports.deployUniswapV2 = exports.deployBalancerAdapter = exports.deployBalancer = exports.deployTokens = exports.Platform = void 0;
var hardhat_1 = __importDefault(require("hardhat"));
var ethers_1 = require("ethers");
var utils_1 = require("./utils");
var Strategy_json_1 = __importDefault(require("../artifacts/contracts/Strategy.sol/Strategy.json"));
var StrategyController_json_1 = __importDefault(require("../artifacts/contracts/StrategyController.sol/StrategyController.json"));
var StrategyControllerAdmin_json_1 = __importDefault(require("../artifacts/contracts/StrategyControllerAdmin.sol/StrategyControllerAdmin.json"));
var StrategyProxyFactory_json_1 = __importDefault(require("../artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json"));
var StrategyProxyFactoryAdmin_json_1 = __importDefault(require("../artifacts/contracts/StrategyProxyFactoryAdmin.sol/StrategyProxyFactoryAdmin.json"));
var EnsoOracle_json_1 = __importDefault(require("../artifacts/contracts/oracles/EnsoOracle.sol/EnsoOracle.json"));
var UniswapNaiveOracle_json_1 = __importDefault(require("../artifacts/contracts/oracles/protocols/UniswapNaiveOracle.sol/UniswapNaiveOracle.json"));
var ChainlinkOracle_json_1 = __importDefault(require("../artifacts/contracts/oracles/protocols/ChainlinkOracle.sol/ChainlinkOracle.json"));
var AaveEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/AaveEstimator.sol/AaveEstimator.json"));
var AaveDebtEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/AaveDebtEstimator.sol/AaveDebtEstimator.json"));
var BasicEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/BasicEstimator.sol/BasicEstimator.json"));
var CompoundEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/CompoundEstimator.sol/CompoundEstimator.json"));
var CurveEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/CurveEstimator.sol/CurveEstimator.json"));
var CurveGaugeEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/CurveGaugeEstimator.sol/CurveGaugeEstimator.json"));
var StrategyEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/StrategyEstimator.sol/StrategyEstimator.json"));
var SynthEstimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/SynthEstimator.sol/SynthEstimator.json"));
var UniswapV2Estimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/UniswapV2Estimator.sol/UniswapV2Estimator.json"));
var YEarnV2Estimator_json_1 = __importDefault(require("../artifacts/contracts/oracles/estimators/YEarnV2Estimator.sol/YEarnV2Estimator.json"));
var TokenRegistry_json_1 = __importDefault(require("../artifacts/contracts/oracles/registries/TokenRegistry.sol/TokenRegistry.json"));
var CurvePoolRegistry_json_1 = __importDefault(require("../artifacts/contracts/oracles/registries/CurvePoolRegistry.sol/CurvePoolRegistry.json"));
var UniswapV3Registry_json_1 = __importDefault(require("../artifacts/contracts/oracles/registries/UniswapV3Registry.sol/UniswapV3Registry.json"));
var Whitelist_json_1 = __importDefault(require("../artifacts/contracts/Whitelist.sol/Whitelist.json"));
var LoopRouter_json_1 = __importDefault(require("../artifacts/contracts/routers/LoopRouter.sol/LoopRouter.json"));
var FullRouter_json_1 = __importDefault(require("../artifacts/contracts/routers/FullRouter.sol/FullRouter.json"));
var BatchDepositRouter_json_1 = __importDefault(require("../artifacts/contracts/routers/BatchDepositRouter.sol/BatchDepositRouter.json"));
var GenericRouter_json_1 = __importDefault(require("../artifacts/contracts/routers/GenericRouter.sol/GenericRouter.json"));
var UniswapV2Adapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/UniswapV2Adapter.sol/UniswapV2Adapter.json"));
var UniswapV3Adapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/UniswapV3Adapter.sol/UniswapV3Adapter.json"));
var MetaStrategyAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/MetaStrategyAdapter.sol/MetaStrategyAdapter.json"));
var AaveLendAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/AaveLendAdapter.sol/AaveLendAdapter.json"));
var AaveBorrowAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/AaveBorrowAdapter.sol/AaveBorrowAdapter.json"));
var CompoundAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/CompoundAdapter.sol/CompoundAdapter.json"));
var CurveAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/CurveAdapter.sol/CurveAdapter.json"));
var CurveLPAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/CurveLPAdapter.sol/CurveLPAdapter.json"));
var CurveRewardsAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/CurveRewardsAdapter.sol/CurveRewardsAdapter.json"));
var SynthetixAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/SynthetixAdapter.sol/SynthetixAdapter.json"));
var YEarnV2Adapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/YEarnV2Adapter.sol/YEarnV2Adapter.json"));
var BalancerAdapter_json_1 = __importDefault(require("../artifacts/contracts/adapters/BalancerAdapter.sol/BalancerAdapter.json"));
var Balancer_json_1 = __importDefault(require("../artifacts/contracts/test/Balancer.sol/Balancer.json"));
var BalancerRegistry_json_1 = __importDefault(require("../artifacts/contracts/test/BalancerRegistry.sol/BalancerRegistry.json"));
var BPool_json_1 = __importDefault(require("../artifacts/@balancer-labs/core/contracts/BPool.sol/BPool.json"));
var ERC20_json_1 = __importDefault(require("@uniswap/v2-periphery/build/ERC20.json"));
var WETH9_json_1 = __importDefault(require("@uniswap/v2-periphery/build/WETH9.json"));
var UniswapV2Factory_json_1 = __importDefault(require("@uniswap/v2-core/build/UniswapV2Factory.json"));
var UniswapV2Pair_json_1 = __importDefault(require("@uniswap/v2-core/build/UniswapV2Pair.json"));
var UniswapV3Factory_json_1 = __importDefault(require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"));
var NFTDescriptor_json_1 = __importDefault(require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"));
var NonfungiblePositionManager_json_1 = __importDefault(require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"));
//import NonfungibleTokenPositionDescriptor from '../artifacts/contracts/test/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json'
var ethers = hardhat_1.default.ethers, waffle = hardhat_1.default.waffle;
var constants = ethers.constants, getContractFactory = ethers.getContractFactory;
var WeiPerEther = constants.WeiPerEther, AddressZero = constants.AddressZero;
var Platform = /** @class */ (function () {
    function Platform(strategyFactory, controller, oracles, administration) {
        this.strategyFactory = strategyFactory;
        this.controller = controller;
        this.oracles = oracles;
        this.administration = administration;
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
        var uniswapFactory, liquidityAmount, i, pairAddress, pair;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, UniswapV2Factory_json_1.default, [owner.address])];
                case 1:
                    uniswapFactory = _a.sent();
                    return [4 /*yield*/, uniswapFactory.deployed()];
                case 2:
                    _a.sent();
                    liquidityAmount = WeiPerEther.mul(100);
                    i = 1;
                    _a.label = 3;
                case 3:
                    if (!(i < tokens.length)) return [3 /*break*/, 10];
                    //tokens[0] is used as the trading pair (WETH)
                    return [4 /*yield*/, uniswapFactory.createPair(tokens[0].address, tokens[i].address)];
                case 4:
                    //tokens[0] is used as the trading pair (WETH)
                    _a.sent();
                    return [4 /*yield*/, uniswapFactory.getPair(tokens[0].address, tokens[i].address)];
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
                case 10: return [2 /*return*/, uniswapFactory];
            }
        });
    });
}
exports.deployUniswapV2 = deployUniswapV2;
// deployUniswapV3: async (owner, tokens) => {
function deployUniswapV3(owner, tokens) {
    return __awaiter(this, void 0, void 0, function () {
        var uniswapFactory, nftDesciptor, UniswapNFTDescriptor, uniswapNFTDescriptor, uniswapNFTManager, i, aNum, bNum, flipper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, UniswapV3Factory_json_1.default)];
                case 1:
                    uniswapFactory = _a.sent();
                    return [4 /*yield*/, uniswapFactory.deployed()];
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
                    return [4 /*yield*/, waffle.deployContract(owner, NonfungiblePositionManager_json_1.default, [uniswapFactory.address, tokens[0].address, uniswapNFTDescriptor.address])];
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
                    return [4 /*yield*/, uniswapNFTManager.createAndInitializePoolIfNecessary(flipper ? tokens[0].address : tokens[i].address, flipper ? tokens[i].address : tokens[0].address, utils_1.UNI_V3_FEE, utils_1.encodePriceSqrt(1, 1))
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
                            fee: utils_1.UNI_V3_FEE,
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
                case 14: return [2 /*return*/, [uniswapFactory, uniswapNFTManager]];
            }
        });
    });
}
exports.deployUniswapV3 = deployUniswapV3;
function deployPlatform(owner, uniswapFactory, weth, susd) {
    return __awaiter(this, void 0, void 0, function () {
        var tokenRegistry, curvePoolRegistry, uniswapV3Registry, basicEstimator, aaveEstimator, aaveDebtEstimator, compoundEstimator, curveEstimator, curveGaugeEstimator, synthEstimator, strategyEstimator, uniswapV2Estimator, yearnV2Estimator, uniswapOracle, chainlinkOracle, ensoOracle, whitelist, strategyImplementation, factoryAdmin, factoryAddress, strategyFactory, controllerAdmin, controllerAddress, controller, oracles, administration;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, TokenRegistry_json_1.default, [])];
                case 1:
                    tokenRegistry = _a.sent();
                    return [4 /*yield*/, tokenRegistry.deployed()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, CurvePoolRegistry_json_1.default, [])];
                case 3:
                    curvePoolRegistry = _a.sent();
                    return [4 /*yield*/, curvePoolRegistry.deployed()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, UniswapV3Registry_json_1.default, [utils_1.ORACLE_TIME_WINDOW, uniswapFactory.address, weth.address])];
                case 5:
                    uniswapV3Registry = _a.sent();
                    return [4 /*yield*/, uniswapV3Registry.deployed()];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, BasicEstimator_json_1.default, [])];
                case 7:
                    basicEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(utils_1.ESTIMATOR_CATEGORY.BASIC, basicEstimator.address)];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, AaveEstimator_json_1.default, [])];
                case 9:
                    aaveEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(utils_1.ESTIMATOR_CATEGORY.AAVE, aaveEstimator.address)];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, AaveDebtEstimator_json_1.default, [])];
                case 11:
                    aaveDebtEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(utils_1.ESTIMATOR_CATEGORY.AAVE_DEBT, aaveDebtEstimator.address)];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, CompoundEstimator_json_1.default, [])];
                case 13:
                    compoundEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(utils_1.ESTIMATOR_CATEGORY.COMPOUND, compoundEstimator.address)];
                case 14:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, CurveEstimator_json_1.default, [curvePoolRegistry.address])];
                case 15:
                    curveEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(utils_1.ESTIMATOR_CATEGORY.CURVE, curveEstimator.address)];
                case 16:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, CurveGaugeEstimator_json_1.default, [])];
                case 17:
                    curveGaugeEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(utils_1.ESTIMATOR_CATEGORY.CURVE_GAUGE, curveGaugeEstimator.address)];
                case 18:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, SynthEstimator_json_1.default, [])];
                case 19:
                    synthEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(utils_1.ESTIMATOR_CATEGORY.SYNTH, synthEstimator.address)];
                case 20:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, StrategyEstimator_json_1.default, [])];
                case 21:
                    strategyEstimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(utils_1.ESTIMATOR_CATEGORY.STRATEGY, strategyEstimator.address)];
                case 22:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, UniswapV2Estimator_json_1.default, [])];
                case 23:
                    uniswapV2Estimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(utils_1.ESTIMATOR_CATEGORY.UNISWAP_V2, uniswapV2Estimator.address)];
                case 24:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, YEarnV2Estimator_json_1.default, [])];
                case 25:
                    yearnV2Estimator = _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addEstimator(utils_1.ESTIMATOR_CATEGORY.YEARN_V2, yearnV2Estimator.address)];
                case 26:
                    _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).addItem(utils_1.ITEM_CATEGORY.RESERVE, utils_1.ESTIMATOR_CATEGORY.BASIC, weth.address)];
                case 27:
                    _a.sent();
                    if (!susd) return [3 /*break*/, 29];
                    return [4 /*yield*/, tokenRegistry.connect(owner).addItem(utils_1.ITEM_CATEGORY.RESERVE, utils_1.ESTIMATOR_CATEGORY.SYNTH, susd.address)];
                case 28:
                    _a.sent();
                    _a.label = 29;
                case 29: return [4 /*yield*/, waffle.deployContract(owner, UniswapNaiveOracle_json_1.default, [uniswapFactory.address, weth.address])];
                case 30:
                    uniswapOracle = _a.sent();
                    return [4 /*yield*/, uniswapOracle.deployed()];
                case 31:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, ChainlinkOracle_json_1.default, [weth.address])];
                case 32:
                    chainlinkOracle = _a.sent();
                    return [4 /*yield*/, chainlinkOracle.deployed()];
                case 33:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, EnsoOracle_json_1.default, [tokenRegistry.address, uniswapOracle.address, chainlinkOracle.address, weth.address, (susd === null || susd === void 0 ? void 0 : susd.address) || AddressZero])];
                case 34:
                    ensoOracle = _a.sent();
                    return [4 /*yield*/, ensoOracle.deployed()
                        // Whitelist
                    ];
                case 35:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, Whitelist_json_1.default, [])];
                case 36:
                    whitelist = _a.sent();
                    return [4 /*yield*/, whitelist.deployed()
                        // Strategy Implementation
                    ];
                case 37:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, Strategy_json_1.default, [])];
                case 38:
                    strategyImplementation = _a.sent();
                    return [4 /*yield*/, strategyImplementation.deployed()
                        // Factory
                    ];
                case 39:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, StrategyProxyFactoryAdmin_json_1.default, [
                            strategyImplementation.address,
                            ensoOracle.address,
                            tokenRegistry.address,
                            whitelist.address
                        ])];
                case 40:
                    factoryAdmin = _a.sent();
                    return [4 /*yield*/, factoryAdmin.deployed()];
                case 41:
                    _a.sent();
                    return [4 /*yield*/, factoryAdmin.factory()];
                case 42:
                    factoryAddress = _a.sent();
                    strategyFactory = new ethers_1.Contract(factoryAddress, StrategyProxyFactory_json_1.default.abi, owner);
                    return [4 /*yield*/, waffle.deployContract(owner, StrategyControllerAdmin_json_1.default, [factoryAddress])];
                case 43:
                    controllerAdmin = _a.sent();
                    return [4 /*yield*/, controllerAdmin.deployed()];
                case 44:
                    _a.sent();
                    return [4 /*yield*/, controllerAdmin.controller()];
                case 45:
                    controllerAddress = _a.sent();
                    controller = new ethers_1.Contract(controllerAddress, StrategyController_json_1.default.abi, owner);
                    return [4 /*yield*/, strategyFactory.connect(owner).setController(controllerAddress)];
                case 46:
                    _a.sent();
                    return [4 /*yield*/, tokenRegistry.connect(owner).transferOwnership(factoryAddress)];
                case 47:
                    _a.sent();
                    oracles = {
                        ensoOracle: ensoOracle,
                        protocols: {
                            uniswapOracle: uniswapOracle,
                            chainlinkOracle: chainlinkOracle
                        },
                        registries: {
                            tokenRegistry: tokenRegistry,
                            curvePoolRegistry: curvePoolRegistry,
                            uniswapV3Registry: uniswapV3Registry
                        }
                    };
                    administration = {
                        whitelist: whitelist,
                        controllerAdmin: controllerAdmin,
                        factoryAdmin: factoryAdmin
                    };
                    return [2 /*return*/, new Platform(strategyFactory, controller, oracles, administration)];
            }
        });
    });
}
exports.deployPlatform = deployPlatform;
function deployUniswapV2Adapter(owner, uniswapFactory, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, UniswapV2Adapter_json_1.default, [uniswapFactory.address, weth.address])];
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
function deployUniswapV3Adapter(owner, uniswapRegistry, uniswapFactory, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, UniswapV3Adapter_json_1.default, [uniswapRegistry.address, uniswapFactory.address, weth.address])];
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
function deployMetaStrategyAdapter(owner, router, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, MetaStrategyAdapter_json_1.default, [router.address, weth.address])];
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
function deployAaveLendAdapter(owner, lendingPool, strategyController, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, AaveLendAdapter_json_1.default, [lendingPool.address, strategyController.address, weth.address])];
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
exports.deployAaveLendAdapter = deployAaveLendAdapter;
function deployAaveBorrowAdapter(owner, lendingPool, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, AaveBorrowAdapter_json_1.default, [lendingPool.address, weth.address])];
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
exports.deployAaveBorrowAdapter = deployAaveBorrowAdapter;
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
function deployCurveAdapter(owner, curvePoolRegistry, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, CurveAdapter_json_1.default, [
                        curvePoolRegistry.address,
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
function deployCurveLPAdapter(owner, curvePoolRegistry, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, CurveLPAdapter_json_1.default, [
                        curvePoolRegistry.address,
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
function deployCurveRewardsAdapter(owner, curvePoolRegistry, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, CurveRewardsAdapter_json_1.default, [
                        curvePoolRegistry.address,
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
exports.deployCurveRewardsAdapter = deployCurveRewardsAdapter;
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
function deployLoopRouter(owner, controller) {
    return __awaiter(this, void 0, void 0, function () {
        var router;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, LoopRouter_json_1.default, [controller.address])];
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
function deployFullRouter(owner, controller) {
    return __awaiter(this, void 0, void 0, function () {
        var router;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, FullRouter_json_1.default, [controller.address])];
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
function deployBatchDepositRouter(owner, controller) {
    return __awaiter(this, void 0, void 0, function () {
        var router;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, BatchDepositRouter_json_1.default, [controller.address])];
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
function deployGenericRouter(owner, controller) {
    return __awaiter(this, void 0, void 0, function () {
        var router;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, GenericRouter_json_1.default, [controller.address])];
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
exports.deployGenericRouter = deployGenericRouter;