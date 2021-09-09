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
var ethers_1 = require("ethers");
var Balancer_json_1 = __importDefault(require("../artifacts/contracts/test/Balancer.sol/Balancer.json"));
var BalancerRegistry_json_1 = __importDefault(require("../artifacts/contracts/test/BalancerRegistry.sol/BalancerRegistry.json"));
var WETH9_json_1 = __importDefault(require("@uniswap/v2-periphery/build/WETH9.json"));
var UniswapV2Factory_json_1 = __importDefault(require("@uniswap/v2-core/build/UniswapV2Factory.json"));
var deploy_1 = require("./deploy");
var utils_1 = require("./utils");
var WeiPerEther = ethers_1.constants.WeiPerEther;
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
            case Adapters.Balancer:
                this.adapters.balancer = adapter;
                break;
            case Adapters.Curve:
                this.adapters.curve = adapter;
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
    EnsoBuilder.prototype.build = function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        return __awaiter(this, void 0, void 0, function () {
            var weth, uniswap, balancer, _q, _r, ensoPlatform, _s, fullRouterIndex;
            var _this = this;
            return __generator(this, function (_t) {
                switch (_t.label) {
                    case 0:
                        weth = {};
                        uniswap = {};
                        balancer = {};
                        this.tokens = (_a = this.tokens) !== null && _a !== void 0 ? _a : [];
                        this.adapters = (_b = this.adapters) !== null && _b !== void 0 ? _b : {};
                        this.routers = (_c = this.routers) !== null && _c !== void 0 ? _c : [];
                        this.network = (_d = this.network) !== null && _d !== void 0 ? _d : Networks.Mainnet;
                        console.log('Setting up EnsoEnvironment on: ', this.network);
                        _q = this.network;
                        switch (_q) {
                            case Networks.LocalTestnet: return [3 /*break*/, 1];
                            case Networks.Mainnet: return [3 /*break*/, 4];
                            case Networks.ExternalTestnet: return [3 /*break*/, 5];
                        }
                        return [3 /*break*/, 6];
                    case 1:
                        _r = this;
                        return [4 /*yield*/, deploy_1.deployTokens(this.signer, this.defaults.numTokens, this.defaults.wethSupply)];
                    case 2:
                        _r.tokens = _t.sent();
                        if (this.tokens === undefined)
                            throw Error('Failed to deploy erc20 tokens');
                        return [4 /*yield*/, deploy_1.deployUniswapV2(this.signer, this.tokens)];
                    case 3:
                        uniswap = _t.sent();
                        return [3 /*break*/, 7];
                    case 4:
                        this.tokens[0] = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.WETH, WETH9_json_1.default.abi, this.signer);
                        this.tokens[0].connect(this.signer);
                        uniswap = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.UNISWAP, UniswapV2Factory_json_1.default.abi, this.signer);
                        return [3 /*break*/, 7];
                    case 5: throw Error('External testnet not implemented yet');
                    case 6:
                        this.tokens[0] = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.WETH, WETH9_json_1.default.abi, this.signer);
                        this.tokens[0].connect(this.signer);
                        uniswap = new ethers_1.Contract(utils_1.MAINNET_ADDRESSES.UNISWAP, UniswapV2Factory_json_1.default.abi, this.signer);
                        _t.label = 7;
                    case 7:
                        weth = this.tokens[0];
                        return [4 /*yield*/, deploy_1.deployPlatform(this.signer, uniswap, weth)];
                    case 8:
                        ensoPlatform = _t.sent();
                        ensoPlatform.print();
                        // Provide all routers by default
                        if (this.routers.length === 0) {
                            this.addRouter('generic');
                            this.addRouter('loop');
                            this.addRouter('full');
                        }
                        _s = this;
                        return [4 /*yield*/, Promise.all(this.routers.map(function (r) { return __awaiter(_this, void 0, void 0, function () {
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0: return [4 /*yield*/, r.deploy(this.signer, ensoPlatform.controller)];
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
                        _s.routers = _t.sent();
                        // We need uniswap
                        if (((_e = this.adapters) === null || _e === void 0 ? void 0 : _e.uniswap) === undefined) {
                            this.addAdapter('uniswap');
                        }
                        if (((_f = this.adapters) === null || _f === void 0 ? void 0 : _f.metastrategy) === undefined) {
                            this.addAdapter('metastrategy');
                        }
                        if (!(((_g = this.adapters) === null || _g === void 0 ? void 0 : _g.uniswap) !== undefined)) return [3 /*break*/, 12];
                        return [4 /*yield*/, this.adapters.uniswap.deploy(this.signer, uniswap, weth)];
                    case 10:
                        _t.sent();
                        return [4 /*yield*/, ensoPlatform.administration.whitelist.connect(this.signer).approve((_h = this.adapters.uniswap.contract) === null || _h === void 0 ? void 0 : _h.address)];
                    case 11:
                        _t.sent();
                        _t.label = 12;
                    case 12:
                        if (!(((_j = this.adapters) === null || _j === void 0 ? void 0 : _j.balancer) !== undefined)) return [3 /*break*/, 16];
                        return [4 /*yield*/, this.deployBalancer()];
                    case 13:
                        balancer = _t.sent();
                        return [4 /*yield*/, this.adapters.balancer.deploy(this.signer, balancer.registry, weth)];
                    case 14:
                        _t.sent();
                        return [4 /*yield*/, ensoPlatform.administration.whitelist.connect(this.signer).approve((_k = this.adapters.balancer.contract) === null || _k === void 0 ? void 0 : _k.address)];
                    case 15:
                        _t.sent();
                        _t.label = 16;
                    case 16:
                        if (!(((_l = this.adapters) === null || _l === void 0 ? void 0 : _l.curve) !== undefined)) return [3 /*break*/, 19];
                        return [4 /*yield*/, this.adapters.curve.deploy(this.signer, ensoPlatform.oracles.registries.curvePoolRegistry, weth)];
                    case 17:
                        _t.sent();
                        return [4 /*yield*/, ensoPlatform.administration.whitelist.connect(this.signer).approve((_m = this.adapters.curve.contract) === null || _m === void 0 ? void 0 : _m.address)];
                    case 18:
                        _t.sent();
                        _t.label = 19;
                    case 19:
                        fullRouterIndex = this.routers.findIndex(function (router) { return router.type == Routers.Full; });
                        if (!(((_o = this.adapters) === null || _o === void 0 ? void 0 : _o.metastrategy) !== undefined && fullRouterIndex > -1)) return [3 /*break*/, 22];
                        return [4 /*yield*/, this.adapters.metastrategy.deploy(this.signer, this.routers[fullRouterIndex].contract || new ethers_1.Contract('0x', [], this.signer), weth)];
                    case 20:
                        _t.sent();
                        return [4 /*yield*/, ensoPlatform.administration.whitelist.connect(this.signer).approve((_p = this.adapters.metastrategy.contract) === null || _p === void 0 ? void 0 : _p.address)];
                    case 21:
                        _t.sent();
                        _t.label = 22;
                    case 22:
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
})(Adapters = exports.Adapters || (exports.Adapters = {}));
var Adapter = /** @class */ (function () {
    function Adapter(adapterType) {
        switch (adapterType.toLowerCase()) {
            case Adapters.Uniswap:
                this.type = Adapters.Uniswap;
                break;
            case Adapters.Balancer:
                this.type = Adapters.Balancer;
                break;
            case Adapters.Curve:
                this.type = Adapters.Curve;
                break;
            case Adapters.Synthetix:
                this.type = Adapters.Synthetix;
                break;
            case Adapters.MetaStrategy:
                this.type = Adapters.MetaStrategy;
                break;
            default:
                throw Error('Invalid adapter selected! Accepted inputs: uniswap/balancer');
        }
    }
    Adapter.prototype.deploy = function (signer, adapterTargetFactory, weth) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        if (!(this.type === Adapters.Uniswap)) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, deploy_1.deployUniswapV2Adapter(signer, adapterTargetFactory, weth)];
                    case 1:
                        _a.contract = _f.sent();
                        return [3 /*break*/, 10];
                    case 2:
                        if (!(this.type === Adapters.Balancer)) return [3 /*break*/, 4];
                        _b = this;
                        return [4 /*yield*/, deploy_1.deployBalancerAdapter(signer, adapterTargetFactory, weth)];
                    case 3:
                        _b.contract = _f.sent();
                        return [3 /*break*/, 10];
                    case 4:
                        if (!(this.type === Adapters.Curve)) return [3 /*break*/, 6];
                        _c = this;
                        return [4 /*yield*/, deploy_1.deployCurveAdapter(signer, adapterTargetFactory, weth)];
                    case 5:
                        _c.contract = _f.sent();
                        return [3 /*break*/, 10];
                    case 6:
                        if (!(this.type === Adapters.Synthetix)) return [3 /*break*/, 8];
                        _d = this;
                        return [4 /*yield*/, deploy_1.deploySynthetixAdapter(signer, adapterTargetFactory, weth)];
                    case 7:
                        _d.contract = _f.sent();
                        return [3 /*break*/, 10];
                    case 8:
                        _e = this;
                        return [4 /*yield*/, deploy_1.deployMetaStrategyAdapter(signer, adapterTargetFactory, weth)];
                    case 9:
                        _e.contract = _f.sent();
                        _f.label = 10;
                    case 10: return [2 /*return*/];
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
            default:
                throw Error('failed to parse router type: ensobuilder.withrouter() accepted input: generic/loop || genericrouter/looprouter');
        }
    }
    Router.prototype.deploy = function (signer, controller) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!(this.type == Routers.Generic)) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, deploy_1.deployGenericRouter(signer, controller)];
                    case 1:
                        _a.contract = _d.sent();
                        return [3 /*break*/, 6];
                    case 2:
                        if (!(this.type == Routers.Full)) return [3 /*break*/, 4];
                        _b = this;
                        return [4 /*yield*/, deploy_1.deployFullRouter(signer, controller)];
                    case 3:
                        _b.contract = _d.sent();
                        return [3 /*break*/, 6];
                    case 4:
                        _c = this;
                        return [4 /*yield*/, deploy_1.deployLoopRouter(signer, controller)];
                    case 5:
                        _c.contract = _d.sent();
                        _d.label = 6;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return Router;
}());
exports.Router = Router;
