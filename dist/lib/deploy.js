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
exports.deployGenericRouter = exports.deployLoopRouter = exports.deployPlatform = exports.Platform = exports.deployUniswapV2Adapter = exports.deployUniswapV3 = exports.deployUniswapV2 = exports.deployBalancerAdapter = exports.deployBalancer = exports.deployTokens = void 0;
var hre = require('hardhat');
var ethers_1 = require("ethers");
var utils_1 = require("./utils");
var ERC20_json_1 = __importDefault(require("@uniswap/v2-periphery/build/ERC20.json"));
var WETH9_json_1 = __importDefault(require("@uniswap/v2-periphery/build/WETH9.json"));
var UniswapV2Factory_json_1 = __importDefault(require("@uniswap/v2-core/build/UniswapV2Factory.json"));
var UniswapV2Pair_json_1 = __importDefault(require("@uniswap/v2-core/build/UniswapV2Pair.json"));
var UniswapV3Factory_json_1 = __importDefault(require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"));
var NonfungiblePositionManager_json_1 = __importDefault(require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"));
var NonfungibleTokenPositionDescriptor_json_1 = __importDefault(require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"));
var ethers = hre.ethers, waffle = hre.waffle;
var constants = ethers.constants, getContractFactory = ethers.getContractFactory;
var WeiPerEther = constants.WeiPerEther;
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
        var BalancerFactory, BalancerRegistry, Pool, balancerFactory, balancerRegistry, i, tx, receipt, poolAddress, pool;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getContractFactory('Balancer')];
                case 1:
                    BalancerFactory = _a.sent();
                    return [4 /*yield*/, getContractFactory('BalancerRegistry')];
                case 2:
                    BalancerRegistry = _a.sent();
                    return [4 /*yield*/, getContractFactory('BPool')];
                case 3:
                    Pool = _a.sent();
                    return [4 /*yield*/, BalancerFactory.connect(owner).deploy()];
                case 4:
                    balancerFactory = _a.sent();
                    return [4 /*yield*/, balancerFactory.deployed()];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, BalancerRegistry.connect(owner).deploy(balancerFactory.address)];
                case 6:
                    balancerRegistry = _a.sent();
                    return [4 /*yield*/, balancerRegistry.deployed()];
                case 7:
                    _a.sent();
                    i = 0;
                    _a.label = 8;
                case 8:
                    if (!(i < tokens.length)) return [3 /*break*/, 19];
                    if (!(i !== 0)) return [3 /*break*/, 18];
                    return [4 /*yield*/, balancerFactory.newBPool()];
                case 9:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 10:
                    receipt = _a.sent();
                    if (receipt.events === undefined ||
                        receipt.events[0].args === undefined ||
                        receipt.events[0].args.pool === undefined) {
                        throw new Error('deployBalancer() -> Failed to find pool arg in newBPool() event');
                    }
                    poolAddress = receipt.events[0].args.pool;
                    pool = Pool.connect(owner).attach(poolAddress);
                    return [4 /*yield*/, tokens[0].approve(poolAddress, WeiPerEther.mul(100))];
                case 11:
                    _a.sent();
                    return [4 /*yield*/, tokens[i].approve(poolAddress, WeiPerEther.mul(100))];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, pool.bind(tokens[0].address, WeiPerEther.mul(100), WeiPerEther.mul(5))];
                case 13:
                    _a.sent();
                    return [4 /*yield*/, pool.bind(tokens[i].address, WeiPerEther.mul(100), WeiPerEther.mul(5))];
                case 14:
                    _a.sent();
                    return [4 /*yield*/, pool.finalize()];
                case 15:
                    _a.sent();
                    return [4 /*yield*/, balancerRegistry.addPoolPair(poolAddress, tokens[0].address, tokens[i].address)];
                case 16:
                    _a.sent();
                    return [4 /*yield*/, balancerRegistry.sortPools([tokens[0].address, tokens[i].address], ethers_1.BigNumber.from(3))];
                case 17:
                    _a.sent();
                    _a.label = 18;
                case 18:
                    i++;
                    return [3 /*break*/, 8];
                case 19: return [2 /*return*/, [balancerFactory, balancerRegistry]];
            }
        });
    });
}
exports.deployBalancer = deployBalancer;
function deployBalancerAdapter(owner, balancerRegistry, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var BalancerAdapter, adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getContractFactory('BalancerAdapter')];
                case 1:
                    BalancerAdapter = _a.sent();
                    return [4 /*yield*/, BalancerAdapter.connect(owner).deploy(balancerRegistry.address, weth.address)];
                case 2:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 3:
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
        var uniswapFactory, uniswapNFTDescriptor, uniswapNFTManager, i, aNum, bNum;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, waffle.deployContract(owner, UniswapV3Factory_json_1.default)];
                case 1:
                    uniswapFactory = _a.sent();
                    return [4 /*yield*/, uniswapFactory.deployed()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, NonfungibleTokenPositionDescriptor_json_1.default, [tokens[0].address])];
                case 3:
                    uniswapNFTDescriptor = _a.sent();
                    return [4 /*yield*/, waffle.deployContract(owner, NonfungiblePositionManager_json_1.default, [uniswapFactory.address, tokens[0].address, uniswapNFTDescriptor.address])];
                case 4:
                    uniswapNFTManager = _a.sent();
                    return [4 /*yield*/, tokens[0].connect(owner).approve(uniswapNFTManager.address, constants.MaxUint256)];
                case 5:
                    _a.sent();
                    i = 1;
                    _a.label = 6;
                case 6:
                    if (!(i < tokens.length)) return [3 /*break*/, 11];
                    //tokens[0] is used as the trading pair (WETH)
                    return [4 /*yield*/, uniswapNFTManager.createAndInitializePoolIfNecessary(tokens[0].address, tokens[i].address, utils_1.UNI_V3_FEE, utils_1.encodePriceSqrt(1, 1))
                        // Add liquidity
                    ];
                case 7:
                    //tokens[0] is used as the trading pair (WETH)
                    _a.sent();
                    // Add liquidity
                    return [4 /*yield*/, tokens[i].connect(owner).approve(uniswapNFTManager.address, constants.MaxUint256)];
                case 8:
                    // Add liquidity
                    _a.sent();
                    aNum = ethers.BigNumber.from(tokens[0].address);
                    bNum = ethers.BigNumber.from(tokens[i].address);
                    return [4 /*yield*/, uniswapNFTManager.mint({
                            token0: aNum.lt(bNum) ? tokens[0].address : tokens[i].address,
                            token1: aNum.lt(bNum) ? tokens[i].address : tokens[0].address,
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
                case 9:
                    _a.sent();
                    _a.label = 10;
                case 10:
                    i++;
                    return [3 /*break*/, 6];
                case 11: return [2 /*return*/, [uniswapFactory, uniswapNFTManager]];
            }
        });
    });
}
exports.deployUniswapV3 = deployUniswapV3;
function deployUniswapV2Adapter(owner, uniswapFactory, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var UniswapAdapter, adapter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getContractFactory('UniswapV2Adapter')];
                case 1:
                    UniswapAdapter = _a.sent();
                    return [4 /*yield*/, UniswapAdapter.connect(owner).deploy(uniswapFactory.address, weth.address)];
                case 2:
                    adapter = _a.sent();
                    return [4 /*yield*/, adapter.deployed()];
                case 3:
                    _a.sent();
                    return [2 /*return*/, adapter];
            }
        });
    });
}
exports.deployUniswapV2Adapter = deployUniswapV2Adapter;
var Platform = /** @class */ (function () {
    function Platform(strategyFactory, controller, oracle, whitelist, controllerAdmin) {
        this.strategyFactory = strategyFactory;
        this.controller = controller;
        this.oracle = oracle;
        this.whitelist = whitelist;
        this.controllerAdmin = controllerAdmin;
    }
    Platform.prototype.print = function () {
        console.log('Enso Platform: ');
        console.log('  Factory: ', this.strategyFactory.address);
        console.log('  Controller: ', this.controller.address);
        console.log('  Oracle: ', this.oracle.address);
        console.log('  Whitelist: ', this.whitelist.address);
        console.log('  ControllerAdmin: ', this.controllerAdmin.address);
    };
    return Platform;
}());
exports.Platform = Platform;
function deployPlatform(owner, uniswapFactory, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var Oracle, oracle, Whitelist, whitelist, Strategy, strategyImplementation, StrategyProxyFactoryAdmin, factoryAdmin, factoryAddress, StrategyProxyFactory, strategyFactory, StrategyControllerAdmin, controllerAdmin, controllerAddress, StrategyController, controller;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getContractFactory('UniswapNaiveOracle')];
                case 1:
                    Oracle = _a.sent();
                    return [4 /*yield*/, Oracle.connect(owner).deploy(uniswapFactory.address, weth.address)];
                case 2:
                    oracle = _a.sent();
                    return [4 /*yield*/, oracle.deployed()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, getContractFactory('Whitelist')];
                case 4:
                    Whitelist = _a.sent();
                    return [4 /*yield*/, Whitelist.connect(owner).deploy()];
                case 5:
                    whitelist = _a.sent();
                    return [4 /*yield*/, whitelist.deployed()];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, getContractFactory('Strategy')];
                case 7:
                    Strategy = _a.sent();
                    return [4 /*yield*/, Strategy.connect(owner).deploy()];
                case 8:
                    strategyImplementation = _a.sent();
                    return [4 /*yield*/, strategyImplementation.deployed()];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, getContractFactory('StrategyProxyFactoryAdmin')];
                case 10:
                    StrategyProxyFactoryAdmin = _a.sent();
                    return [4 /*yield*/, StrategyProxyFactoryAdmin.connect(owner).deploy(strategyImplementation.address, oracle.address, whitelist.address)];
                case 11:
                    factoryAdmin = _a.sent();
                    return [4 /*yield*/, factoryAdmin.deployed()];
                case 12:
                    _a.sent();
                    return [4 /*yield*/, factoryAdmin.factory()];
                case 13:
                    factoryAddress = _a.sent();
                    return [4 /*yield*/, getContractFactory('StrategyProxyFactory')];
                case 14:
                    StrategyProxyFactory = _a.sent();
                    return [4 /*yield*/, StrategyProxyFactory.attach(factoryAddress)];
                case 15:
                    strategyFactory = _a.sent();
                    return [4 /*yield*/, getContractFactory('StrategyControllerAdmin')];
                case 16:
                    StrategyControllerAdmin = _a.sent();
                    return [4 /*yield*/, StrategyControllerAdmin.connect(owner).deploy(factoryAddress)];
                case 17:
                    controllerAdmin = _a.sent();
                    return [4 /*yield*/, controllerAdmin.deployed()];
                case 18:
                    _a.sent();
                    return [4 /*yield*/, controllerAdmin.controller()];
                case 19:
                    controllerAddress = _a.sent();
                    return [4 /*yield*/, getContractFactory('StrategyController')];
                case 20:
                    StrategyController = _a.sent();
                    return [4 /*yield*/, StrategyController.attach(controllerAddress)];
                case 21:
                    controller = _a.sent();
                    return [4 /*yield*/, strategyFactory.connect(owner).setController(controllerAddress)];
                case 22:
                    _a.sent();
                    return [2 /*return*/, new Platform(strategyFactory, controller, oracle, whitelist, controllerAdmin)];
            }
        });
    });
}
exports.deployPlatform = deployPlatform;
function deployLoopRouter(owner, controller, adapter, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var LoopRouter, router;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getContractFactory('LoopRouter')];
                case 1:
                    LoopRouter = _a.sent();
                    return [4 /*yield*/, LoopRouter.connect(owner).deploy(adapter.address, controller.address, weth.address)];
                case 2:
                    router = _a.sent();
                    return [4 /*yield*/, router.deployed()];
                case 3:
                    _a.sent();
                    return [2 /*return*/, router];
            }
        });
    });
}
exports.deployLoopRouter = deployLoopRouter;
function deployGenericRouter(owner, controller, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var GenericRouter, router;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ethers.getContractFactory('GenericRouter')];
                case 1:
                    GenericRouter = _a.sent();
                    return [4 /*yield*/, GenericRouter.connect(owner).deploy(controller.address, weth.address)];
                case 2:
                    router = _a.sent();
                    return [4 /*yield*/, router.deployed()];
                case 3:
                    _a.sent();
                    return [2 /*return*/, router];
            }
        });
    });
}
exports.deployGenericRouter = deployGenericRouter;
