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
exports.Router = exports.Routers = exports.Adapter = exports.Adapters = exports.Networks = exports.Balancer = exports.EnsoEnvironment = exports.EnsoBuilder = exports.wethPerToken = void 0;
var hardhat_1 = require("hardhat");
var ethers_1 = require("ethers");
var Balancer_json_1 = __importDefault(require("../artifacts/contracts/test/Balancer.sol/Balancer.json"));
var BalancerRegistry_json_1 = __importDefault(require("../artifacts/contracts/test/BalancerRegistry.sol/BalancerRegistry.json"));
var WETH9_json_1 = __importDefault(require("@uniswap/v2-periphery/build/WETH9.json"));
var ERC20_json_1 = __importDefault(require("@uniswap/v2-periphery/build/ERC20.json"));
var UniswapV2Factory_json_1 = __importDefault(require("@uniswap/v2-core/build/UniswapV2Factory.json"));
var deploy_1 = require("./deploy");
var utils_1 = require("./utils");
var _a = hardhat_1.ethers.constants, AddressZero = _a.AddressZero, WeiPerEther = _a.WeiPerEther;
var NULL_CONTRACT = new ethers_1.Contract(AddressZero, [], hardhat_1.ethers.provider);
var wethPerToken = function (numTokens) { return ethers_1.BigNumber.from(WeiPerEther).mul(100 * (numTokens - 1)); };
exports.wethPerToken = wethPerToken;
var EnsoBuilder = /** @class */ (function () {
    function EnsoBuilder(signer) {
        this.signer = signer;
        this.defaults = {
            threshold: 10,
            slippage: 995,
            timelock: 60,
            numTokens: 15,
            wethSupply: exports.wethPerToken(15),
        };
    }
    EnsoBuilder.prototype.mainnet = function () {
        this.network = Networks.Mainnet;
        return this;
    };
    EnsoBuilder.prototype.testnet = function () {
        this.network = Networks.LocalTestnet;
        return this;
    };
    EnsoBuilder.prototype.setDefaults = function (defaults) {
        this.defaults = defaults;
    };
    EnsoBuilder.prototype.addRouter = function (type) {
        var _a;
        this.routers = (_a = this.routers) !== null && _a !== void 0 ? _a : [];
        this.routers.push(new Router(type));
        return this;
    };
    EnsoBuilder.prototype.addAdapter = function (type) {
        var _a;
        this.adapters = (_a = this.adapters) !== null && _a !== void 0 ? _a : {};
        var adapter = new Adapter(type);
        switch (adapter.type) {
            case Adapters.AaveBorrow:
                this.adapters.aaveborrow = adapter;
                break;
            case Adapters.AaveLend:
                this.adapters.aavelend = adapter;
                break;
            case Adapters.Balancer:
                this.adapters.balancer = adapter;
                break;
            case Adapters.Curve:
                this.adapters.curve = adapter;
                break;
            case Adapters.Leverage:
                this.adapters.leverage = adapter;
                break;
            case Adapters.Synthetix:
                this.adapters.synthetix = adapter;
                break;
            case Adapters.MetaStrategy:
                this.adapters.metastrategy = adapter;
                break;
            case Adapters.Uniswap:
                this.adapters.uniswap = adapter;
                break;
            default:
                throw Error('Invalid adapter type');
        }
        return this;
    };
    EnsoBuilder.prototype.deployBalancer = function () {
        return __awaiter(this, void 0, void 0, function () {
            var balancer, factory, registry, _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (this.tokens === undefined)
                            throw Error('Tried deploying balancer with no erc20 tokens');
                        balancer = {};
                        factory = {};
                        registry = {};
                        _a = this.network;
                        switch (_a) {
                            case Networks.LocalTestnet: return [3 /*break*/, 1];
                            case Networks.Mainnet: return [3 /*break*/, 3];
                            case Networks.ExternalTestnet: return [3 /*break*/, 4];
                        }
                        return [3 /*break*/, 5];
                    case 1: return [4 /*yield*/, deploy_1.deployBalancer(this.signer, this.tokens)];
                    case 2:
                        _b = _c.sent(), factory = _b[0], registry = _b[1];
                        balancer = new Balancer(factory, registry);
                        return [3 /*break*/, 6];
                    case 3:
                        factory = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.BALANCER_FACTORY, Balancer_json_1.default.abi, this.signer);
                        registry = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.BALANCER_REGISTRY, BalancerRegistry_json_1.default.abi, this.signer);
                        balancer = new Balancer(factory, registry);
                        return [3 /*break*/, 6];
                    case 4: throw Error('External testnet not implemented yet');
                    case 5:
                        factory = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.BALANCER_FACTORY, Balancer_json_1.default.abi, this.signer);
                        registry = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.BALANCER_REGISTRY, BalancerRegistry_json_1.default.abi, this.signer);
                        balancer = new Balancer(factory, registry);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, balancer];
                }
            });
        });
    };
    // Defaults to Mainnet-fork
    // Defaults to Mainnet-fork
    EnsoBuilder.prototype.build = function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        return __awaiter(this, void 0, void 0, function () {
            var weth, susd, usdc, uniswap, balancer, _s, _t, ensoPlatform, _u, fullRouterIndex;
            var _this = this;
            return __generator(this, function (_v) {
                switch (_v.label) {
                    case 0:
                        weth = {};
                        susd = {};
                        usdc = {};
                        uniswap = {};
                        balancer = {};
                        this.tokens = (_a = this.tokens) !== null && _a !== void 0 ? _a : [];
                        this.adapters = (_b = this.adapters) !== null && _b !== void 0 ? _b : {};
                        this.routers = (_c = this.routers) !== null && _c !== void 0 ? _c : [];
                        this.network = (_d = this.network) !== null && _d !== void 0 ? _d : Networks.Mainnet;
                        console.log('Setting up EnsoEnvironment on: ', this.network);
                        _s = this.network;
                        switch (_s) {
                            case Networks.LocalTestnet: return [3 /*break*/, 1];
                            case Networks.Mainnet: return [3 /*break*/, 4];
                            case Networks.ExternalTestnet: return [3 /*break*/, 5];
                        }
                        return [3 /*break*/, 6];
                    case 1:
                        _t = this;
                        return [4 /*yield*/, deploy_1.deployTokens(this.signer, this.defaults.numTokens, this.defaults.wethSupply)];
                    case 2:
                        _t.tokens = _v.sent();
                        if (this.tokens === undefined)
                            throw Error('Failed to deploy erc20 tokens');
                        return [4 /*yield*/, deploy_1.deployUniswapV2(this.signer, this.tokens)];
                    case 3:
                        uniswap = _v.sent();
                        return [3 /*break*/, 7];
                    case 4:
                        this.tokens[0] = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.WETH, WETH9_json_1.default.abi, this.signer);
                        this.tokens[0].connect(this.signer);
                        this.tokens[1] = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.SUSD, ERC20_json_1.default.abi, this.signer);
                        this.tokens[1].connect(this.signer);
                        this.tokens[2] = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.USDC, ERC20_json_1.default.abi, this.signer);
                        this.tokens[2].connect(this.signer);
                        uniswap = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.UNISWAP, UniswapV2Factory_json_1.default.abi, this.signer);
                        return [3 /*break*/, 7];
                    case 5: throw Error('External testnet not implemented yet');
                    case 6:
                        this.tokens[0] = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.WETH, WETH9_json_1.default.abi, this.signer);
                        this.tokens[0].connect(this.signer);
                        this.tokens[1] = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.SUSD, ERC20_json_1.default.abi, this.signer);
                        this.tokens[1].connect(this.signer);
                        this.tokens[2] = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.USDC, ERC20_json_1.default.abi, this.signer);
                        this.tokens[2].connect(this.signer);
                        uniswap = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.UNISWAP, UniswapV2Factory_json_1.default.abi, this.signer);
                        _v.label = 7;
                    case 7:
                        weth = this.tokens[0];
                        if (this.tokens[1])
                            susd = this.tokens[1];
                        if (this.tokens[2])
                            usdc = this.tokens[2];
                        return [4 /*yield*/, deploy_1.deployPlatform(this.signer, uniswap, weth, susd)];
                    case 8:
                        ensoPlatform = _v.sent();
                        ensoPlatform.print();
                        // Provide all routers by default
                        if (this.routers.length === 0) {
                            this.addRouter('generic');
                            this.addRouter('loop');
                            this.addRouter('full');
                            this.addRouter('batch');
                        }
                        _u = this;
                        return [4 /*yield*/, Promise.all(this.routers.map(function (r) { return __awaiter(_this, void 0, void 0, function () {
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0: return [4 /*yield*/, r.deploy(this.signer, ensoPlatform.controller, ensoPlatform.library)];
                                        case 1:
                                            _b.sent();
                                            return [4 /*yield*/, ensoPlatform.administration.whitelist.connect(this.signer).approve((_a = r.contract) === null || _a === void 0 ? void 0 : _a.address)];
                                        case 2:
                                            _b.sent();
                                            return [2 /*return*/, r];
                                    }
                                });
                            }); }))
                            // We need uniswap
                        ];
                    case 9:
                        _u.routers = _v.sent();
                        // We need uniswap
                        if (((_e = this.adapters) === null || _e === void 0 ? void 0 : _e.uniswap) === undefined) {
                            this.addAdapter('uniswap');
                        }
                        if (((_f = this.adapters) === null || _f === void 0 ? void 0 : _f.metastrategy) === undefined) {
                            this.addAdapter('metastrategy');
                        }
                        if (((_g = this.adapters) === null || _g === void 0 ? void 0 : _g.leverage) !== undefined) {
                            // AaveLend and AaveBorrow always needed for leverage
                            if (((_h = this.adapters) === null || _h === void 0 ? void 0 : _h.aavelend) === undefined)
                                this.addAdapter('aavelend');
                            if (((_j = this.adapters) === null || _j === void 0 ? void 0 : _j.aaveborrow) === undefined)
                                this.addAdapter('aaveborrow');
                        }
                        if (!(((_k = this.adapters) === null || _k === void 0 ? void 0 : _k.uniswap) !== undefined)) return [3 /*break*/, 11];
                        return [4 /*yield*/, this.adapters.uniswap.deploy(this.signer, ensoPlatform, uniswap, weth)];
                    case 10:
                        _v.sent();
                        _v.label = 11;
                    case 11:
                        if (!(((_l = this.adapters) === null || _l === void 0 ? void 0 : _l.balancer) !== undefined)) return [3 /*break*/, 14];
                        return [4 /*yield*/, this.deployBalancer()];
                    case 12:
                        balancer = _v.sent();
                        return [4 /*yield*/, this.adapters.balancer.deploy(this.signer, ensoPlatform, balancer.registry, weth)];
                    case 13:
                        _v.sent();
                        _v.label = 14;
                    case 14:
                        if (!(((_m = this.adapters) === null || _m === void 0 ? void 0 : _m.curve) !== undefined)) return [3 /*break*/, 16];
                        return [4 /*yield*/, this.adapters.curve.deploy(this.signer, ensoPlatform, new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.CURVE_ADDRESS_PROVIDER, [], this.signer), weth)];
                    case 15:
                        _v.sent();
                        _v.label = 16;
                    case 16:
                        if (!(((_o = this.adapters) === null || _o === void 0 ? void 0 : _o.aavelend) !== undefined)) return [3 /*break*/, 18];
                        return [4 /*yield*/, this.adapters.aavelend.deploy(this.signer, ensoPlatform, new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], this.signer), weth)];
                    case 17:
                        _v.sent();
                        _v.label = 18;
                    case 18:
                        if (!(((_p = this.adapters) === null || _p === void 0 ? void 0 : _p.aaveborrow) !== undefined)) return [3 /*break*/, 20];
                        return [4 /*yield*/, this.adapters.aaveborrow.deploy(this.signer, ensoPlatform, new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], this.signer), weth)];
                    case 19:
                        _v.sent();
                        _v.label = 20;
                    case 20:
                        if (!(((_q = this.adapters) === null || _q === void 0 ? void 0 : _q.leverage) !== undefined)) return [3 /*break*/, 22];
                        return [4 /*yield*/, this.adapters.leverage.deploy(this.signer, ensoPlatform, usdc, weth, this.adapters)];
                    case 21:
                        _v.sent();
                        _v.label = 22;
                    case 22:
                        fullRouterIndex = this.routers.findIndex(function (router) { return router.type == Routers.Full; });
                        if (!(((_r = this.adapters) === null || _r === void 0 ? void 0 : _r.metastrategy) !== undefined && fullRouterIndex > -1)) return [3 /*break*/, 24];
                        return [4 /*yield*/, this.adapters.metastrategy.deploy(this.signer, ensoPlatform, this.routers[fullRouterIndex].contract || NULL_CONTRACT, weth)];
                    case 23:
                        _v.sent();
                        _v.label = 24;
                    case 24:
                        // Safety check
                        if (this.adapters === undefined)
                            throw Error('Failed to add adapters');
                        if (this.routers === undefined)
                            throw Error('Failed to deploy routers');
                        return [2 /*return*/, new EnsoEnvironment(this.signer, this.defaults, ensoPlatform, this.adapters, this.routers, uniswap, this.tokens, balancer)];
                }
            });
        });
    };
    return EnsoBuilder;
}());
exports.EnsoBuilder = EnsoBuilder;
// TODO: move adapters + routers into enso.Platform object
var EnsoEnvironment = /** @class */ (function () {
    function EnsoEnvironment(signer, defaults, platform, adapters, routers, uniswap, tokens, balancer) {
        this.signer = signer;
        this.defaults = defaults;
        this.platform = platform;
        this.adapters = adapters;
        this.routers = routers;
        this.uniswap = uniswap;
        this.tokens = tokens;
        this.balancer = balancer === undefined ? balancer : undefined;
    }
    return EnsoEnvironment;
}());
exports.EnsoEnvironment = EnsoEnvironment;
var Balancer = /** @class */ (function () {
    function Balancer(factory, registry) {
        this.factory = factory;
        this.registry = registry;
    }
    return Balancer;
}());
exports.Balancer = Balancer;
var Networks;
(function (Networks) {
    Networks["Mainnet"] = "Mainnet";
    Networks["LocalTestnet"] = "LocalTestnet";
    Networks["ExternalTestnet"] = "ExternalTestnet";
})(Networks = exports.Networks || (exports.Networks = {}));
var Adapters;
(function (Adapters) {
    Adapters["Balancer"] = "balancer";
    Adapters["Curve"] = "curve";
    Adapters["MetaStrategy"] = "metastrategy";
    Adapters["Synthetix"] = "synthetix";
    Adapters["Uniswap"] = "uniswap";
    Adapters["AaveLend"] = "aavelend";
    Adapters["AaveBorrow"] = "aaveborrow";
    Adapters["Leverage"] = "leverage";
})(Adapters = exports.Adapters || (exports.Adapters = {}));
var Adapter = /** @class */ (function () {
    function Adapter(adapterType) {
        switch (adapterType.toLowerCase()) {
            case Adapters.AaveBorrow:
                this.type = Adapters.AaveBorrow;
                break;
            case Adapters.AaveLend:
                this.type = Adapters.AaveLend;
                break;
            case Adapters.Balancer:
                this.type = Adapters.Balancer;
                break;
            case Adapters.Curve:
                this.type = Adapters.Curve;
                break;
            case Adapters.Leverage:
                this.type = Adapters.Leverage;
                break;
            case Adapters.MetaStrategy:
                this.type = Adapters.MetaStrategy;
                break;
            case Adapters.Synthetix:
                this.type = Adapters.Synthetix;
                break;
            case Adapters.Uniswap:
                this.type = Adapters.Uniswap;
                break;
            default:
                throw Error('Invalid adapter selected!');
        }
    }
    Adapter.prototype.deploy = function (signer, platform, adapterTargetFactory, weth, adapters) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        if (!(this.type === Adapters.Uniswap)) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, deploy_1.deployUniswapV2Adapter(signer, adapterTargetFactory, weth)];
                    case 1:
                        _a.contract = _j.sent();
                        return [3 /*break*/, 16];
                    case 2:
                        if (!(this.type === Adapters.AaveBorrow)) return [3 /*break*/, 4];
                        _b = this;
                        return [4 /*yield*/, deploy_1.deployAaveBorrowAdapter(signer, adapterTargetFactory, weth)];
                    case 3:
                        _b.contract = _j.sent();
                        return [3 /*break*/, 16];
                    case 4:
                        if (!(this.type === Adapters.AaveLend)) return [3 /*break*/, 6];
                        _c = this;
                        return [4 /*yield*/, deploy_1.deployAaveLendAdapter(signer, adapterTargetFactory, platform.controller, weth)];
                    case 5:
                        _c.contract = _j.sent();
                        return [3 /*break*/, 16];
                    case 6:
                        if (!(this.type === Adapters.Balancer)) return [3 /*break*/, 8];
                        _d = this;
                        return [4 /*yield*/, deploy_1.deployBalancerAdapter(signer, adapterTargetFactory, weth)];
                    case 7:
                        _d.contract = _j.sent();
                        return [3 /*break*/, 16];
                    case 8:
                        if (!(this.type === Adapters.Curve)) return [3 /*break*/, 10];
                        _e = this;
                        return [4 /*yield*/, deploy_1.deployCurveAdapter(signer, adapterTargetFactory, weth)];
                    case 9:
                        _e.contract = _j.sent();
                        return [3 /*break*/, 16];
                    case 10:
                        if (!(this.type === Adapters.Leverage && adapters !== undefined)) return [3 /*break*/, 12];
                        _f = this;
                        return [4 /*yield*/, deploy_1.deployLeverage2XAdapter(signer, adapters.uniswap.contract || NULL_CONTRACT, adapters.aavelend.contract || NULL_CONTRACT, adapters.aaveborrow.contract || NULL_CONTRACT, adapterTargetFactory, weth)];
                    case 11:
                        _f.contract = _j.sent();
                        return [3 /*break*/, 16];
                    case 12:
                        if (!(this.type === Adapters.Synthetix)) return [3 /*break*/, 14];
                        _g = this;
                        return [4 /*yield*/, deploy_1.deploySynthetixAdapter(signer, adapterTargetFactory, weth)];
                    case 13:
                        _g.contract = _j.sent();
                        return [3 /*break*/, 16];
                    case 14:
                        if (!(this.type === Adapters.MetaStrategy)) return [3 /*break*/, 16];
                        _h = this;
                        return [4 /*yield*/, deploy_1.deployMetaStrategyAdapter(signer, platform.controller, adapterTargetFactory, weth)];
                    case 15:
                        _h.contract = _j.sent();
                        _j.label = 16;
                    case 16:
                        if (!(this.contract !== undefined)) return [3 /*break*/, 18];
                        return [4 /*yield*/, platform.administration.whitelist.connect(signer).approve(this.contract.address)];
                    case 17:
                        _j.sent();
                        _j.label = 18;
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    return Adapter;
}());
exports.Adapter = Adapter;
var Routers;
(function (Routers) {
    Routers[Routers["Generic"] = 0] = "Generic";
    Routers[Routers["Loop"] = 1] = "Loop";
    Routers[Routers["Full"] = 2] = "Full";
    Routers[Routers["Batch"] = 3] = "Batch";
})(Routers = exports.Routers || (exports.Routers = {}));
// TODO: implement encoding for each Router (chain calldata for each type of router GenericRouter is IRouter, LoopRouter is IRouter etc..)
var Router = /** @class */ (function () {
    function Router(routerType) {
        switch (routerType.toLowerCase()) {
            case 'generic' || 'genericrouter':
                this.type = Routers.Generic;
                break;
            case 'full' || 'fullrouter':
                this.type = Routers.Full;
                break;
            case 'loop' || 'looprouter':
                this.type = Routers.Loop;
                break;
            case 'batch' || 'batchrouter' || 'batchdepositrouter':
                this.type = Routers.Loop;
                break;
            default:
                throw Error('failed to parse router type: ensobuilder.withrouter() accepted input: generic/loop || genericrouter/looprouter');
        }
    }
    Router.prototype.deploy = function (signer, controller, library) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (!(this.type == Routers.Generic)) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, deploy_1.deployGenericRouter(signer, controller)];
                    case 1:
                        _a.contract = _e.sent();
                        return [3 /*break*/, 8];
                    case 2:
                        if (!(this.type == Routers.Full)) return [3 /*break*/, 4];
                        _b = this;
                        return [4 /*yield*/, deploy_1.deployFullRouter(signer, new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], hardhat_1.ethers.provider), controller, library)];
                    case 3:
                        _b.contract = _e.sent();
                        return [3 /*break*/, 8];
                    case 4:
                        if (!(this.type == Routers.Batch)) return [3 /*break*/, 6];
                        _c = this;
                        return [4 /*yield*/, deploy_1.deployBatchDepositRouter(signer, controller, library)];
                    case 5:
                        _c.contract = _e.sent();
                        return [3 /*break*/, 8];
                    case 6:
                        _d = this;
                        return [4 /*yield*/, deploy_1.deployLoopRouter(signer, controller, library)];
                    case 7:
                        _d.contract = _e.sent();
                        _e.label = 8;
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    return Router;
}());
exports.Router = Router;
