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
var UniswapV3Factory_json_1 = __importDefault(require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"));
var SwapRouter_json_1 = __importDefault(require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"));
var deploy_1 = require("./deploy");
var constants_1 = require("./constants");
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
            wethSupply: exports.wethPerToken(100),
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
            case Adapters.AaveV2Debt:
                this.adapters.aaveV2Debt = adapter;
                break;
            case Adapters.AaveV2:
                this.adapters.aaveV2 = adapter;
                break;
            case Adapters.Balancer:
                this.adapters.balancer = adapter;
                break;
            case Adapters.Compound:
                this.adapters.compound = adapter;
                break;
            case Adapters.Curve:
                this.adapters.curve = adapter;
                break;
            case Adapters.CurveLP:
                this.adapters.curveLP = adapter;
                break;
            case Adapters.CurveGauge:
                this.adapters.curveGauge = adapter;
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
            case Adapters.UniswapV2:
                this.adapters.uniswapV2 = adapter;
                break;
            case Adapters.UniswapV3:
                this.adapters.uniswapV3 = adapter;
                break;
            case Adapters.YEarnV2:
                this.adapters.yearnV2 = adapter;
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
                        factory = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.BALANCER_FACTORY, Balancer_json_1.default.abi, this.signer);
                        registry = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.BALANCER_REGISTRY, BalancerRegistry_json_1.default.abi, this.signer);
                        balancer = new Balancer(factory, registry);
                        return [3 /*break*/, 6];
                    case 4: throw Error('External testnet not implemented yet');
                    case 5:
                        factory = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.BALANCER_FACTORY, Balancer_json_1.default.abi, this.signer);
                        registry = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.BALANCER_REGISTRY, BalancerRegistry_json_1.default.abi, this.signer);
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2;
        return __awaiter(this, void 0, void 0, function () {
            var weth, susd, usdc, uniswapV2Factory, uniswapV3Factory, uniswapV3Router, balancer, _3, _4, ensoPlatform, _5, fullRouterIndex;
            var _this = this;
            return __generator(this, function (_6) {
                switch (_6.label) {
                    case 0:
                        weth = {};
                        susd = {};
                        usdc = {};
                        uniswapV2Factory = {};
                        uniswapV3Factory = {};
                        uniswapV3Router = {};
                        balancer = {};
                        this.tokens = (_a = this.tokens) !== null && _a !== void 0 ? _a : [];
                        this.adapters = (_b = this.adapters) !== null && _b !== void 0 ? _b : {};
                        this.routers = (_c = this.routers) !== null && _c !== void 0 ? _c : [];
                        this.network = (_d = this.network) !== null && _d !== void 0 ? _d : Networks.Mainnet;
                        console.log('Setting up EnsoEnvironment on: ', this.network);
                        _3 = this.network;
                        switch (_3) {
                            case Networks.LocalTestnet: return [3 /*break*/, 1];
                            case Networks.Mainnet: return [3 /*break*/, 6];
                            case Networks.ExternalTestnet: return [3 /*break*/, 7];
                        }
                        return [3 /*break*/, 8];
                    case 1:
                        _4 = this;
                        return [4 /*yield*/, deploy_1.deployTokens(this.signer, this.defaults.numTokens, this.defaults.wethSupply)];
                    case 2:
                        _4.tokens = _6.sent();
                        if (this.tokens === undefined)
                            throw Error('Failed to deploy erc20 tokens');
                        return [4 /*yield*/, deploy_1.deployUniswapV2(this.signer, this.tokens)];
                    case 3:
                        uniswapV2Factory = _6.sent();
                        return [4 /*yield*/, deploy_1.deployUniswapV3(this.signer, this.tokens)];
                    case 4:
                        uniswapV3Factory = (_6.sent())[0];
                        return [4 /*yield*/, hardhat_1.waffle.deployContract(this.signer, SwapRouter_json_1.default, [uniswapV3Factory.address, this.tokens[0].address])];
                    case 5:
                        uniswapV3Router = _6.sent();
                        return [3 /*break*/, 9];
                    case 6:
                        this.tokens[0] = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.WETH, WETH9_json_1.default.abi, this.signer);
                        this.tokens[0].connect(this.signer);
                        this.tokens[1] = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.SUSD, ERC20_json_1.default.abi, this.signer);
                        this.tokens[1].connect(this.signer);
                        this.tokens[2] = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.USDC, ERC20_json_1.default.abi, this.signer);
                        this.tokens[2].connect(this.signer);
                        uniswapV2Factory = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory_json_1.default.abi, this.signer);
                        uniswapV3Factory = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.UNISWAP_V3_FACTORY, UniswapV3Factory_json_1.default.abi, this.signer);
                        uniswapV3Router = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.UNISWAP_V3_ROUTER, SwapRouter_json_1.default.abi, this.signer);
                        return [3 /*break*/, 9];
                    case 7: throw Error('External testnet not implemented yet');
                    case 8:
                        this.tokens[0] = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.WETH, WETH9_json_1.default.abi, this.signer);
                        this.tokens[0].connect(this.signer);
                        this.tokens[1] = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.SUSD, ERC20_json_1.default.abi, this.signer);
                        this.tokens[1].connect(this.signer);
                        this.tokens[2] = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.USDC, ERC20_json_1.default.abi, this.signer);
                        this.tokens[2].connect(this.signer);
                        uniswapV2Factory = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory_json_1.default.abi, this.signer);
                        uniswapV3Factory = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.UNISWAP_V3_FACTORY, UniswapV3Factory_json_1.default.abi, this.signer);
                        uniswapV3Router = new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.UNISWAP_V3_ROUTER, SwapRouter_json_1.default.abi, this.signer);
                        _6.label = 9;
                    case 9:
                        weth = this.tokens[0];
                        if (this.tokens[1])
                            susd = this.tokens[1];
                        if (this.tokens[2])
                            usdc = this.tokens[2];
                        return [4 /*yield*/, deploy_1.deployPlatform(this.signer, uniswapV3Factory, uniswapV3Factory, weth, susd)];
                    case 10:
                        ensoPlatform = _6.sent();
                        ensoPlatform.print();
                        // Provide all routers by default
                        if (this.routers.length === 0) {
                            this.addRouter('generic');
                            this.addRouter('loop');
                            this.addRouter('full');
                            this.addRouter('batch');
                        }
                        _5 = this;
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
                    case 11:
                        _5.routers = _6.sent();
                        // We need uniswap
                        if (((_e = this.adapters) === null || _e === void 0 ? void 0 : _e.uniswap) === undefined && ((_f = this.adapters) === null || _f === void 0 ? void 0 : _f.uniswapV2) === undefined) {
                            this.addAdapter('uniswap');
                        }
                        if (((_g = this.adapters) === null || _g === void 0 ? void 0 : _g.metastrategy) === undefined) {
                            this.addAdapter('metastrategy');
                        }
                        if (((_h = this.adapters) === null || _h === void 0 ? void 0 : _h.leverage) !== undefined) {
                            // AaveV2 and AaveV2Debt always needed for leverage
                            if (((_j = this.adapters) === null || _j === void 0 ? void 0 : _j.aaveV2) === undefined)
                                this.addAdapter('aavev2');
                            if (((_k = this.adapters) === null || _k === void 0 ? void 0 : _k.aaveV2Debt) === undefined)
                                this.addAdapter('aavev2debt');
                        }
                        if (!(((_l = this.adapters) === null || _l === void 0 ? void 0 : _l.aaveV2) !== undefined)) return [3 /*break*/, 13];
                        return [4 /*yield*/, this.adapters.aaveV2.deploy(this.signer, ensoPlatform.administration.whitelist, [new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], this.signer), ensoPlatform.controller, weth])];
                    case 12:
                        _6.sent();
                        _6.label = 13;
                    case 13:
                        if (!(((_m = this.adapters) === null || _m === void 0 ? void 0 : _m.aaveV2Debt) !== undefined)) return [3 /*break*/, 15];
                        return [4 /*yield*/, this.adapters.aaveV2Debt.deploy(this.signer, ensoPlatform.administration.whitelist, [new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], this.signer), weth])];
                    case 14:
                        _6.sent();
                        _6.label = 15;
                    case 15:
                        if (!(((_o = this.adapters) === null || _o === void 0 ? void 0 : _o.balancer) !== undefined)) return [3 /*break*/, 18];
                        return [4 /*yield*/, this.deployBalancer()];
                    case 16:
                        balancer = _6.sent();
                        return [4 /*yield*/, this.adapters.balancer.deploy(this.signer, ensoPlatform.administration.whitelist, [balancer.registry, weth])];
                    case 17:
                        _6.sent();
                        _6.label = 18;
                    case 18:
                        if (!(((_p = this.adapters) === null || _p === void 0 ? void 0 : _p.compound) !== undefined)) return [3 /*break*/, 20];
                        return [4 /*yield*/, this.adapters.compound.deploy(this.signer, ensoPlatform.administration.whitelist, [new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.COMPOUND_COMPTROLLER, [], this.signer), weth])];
                    case 19:
                        _6.sent();
                        _6.label = 20;
                    case 20:
                        if (!(((_q = this.adapters) === null || _q === void 0 ? void 0 : _q.curve) !== undefined)) return [3 /*break*/, 22];
                        return [4 /*yield*/, this.adapters.curve.deploy(this.signer, ensoPlatform.administration.whitelist, [new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.CURVE_ADDRESS_PROVIDER, [], this.signer), weth])];
                    case 21:
                        _6.sent();
                        _6.label = 22;
                    case 22:
                        if (!(((_r = this.adapters) === null || _r === void 0 ? void 0 : _r.curveLP) !== undefined)) return [3 /*break*/, 24];
                        return [4 /*yield*/, this.adapters.curveLP.deploy(this.signer, ensoPlatform.administration.whitelist, [
                                new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.CURVE_ADDRESS_PROVIDER, [], this.signer),
                                ensoPlatform.oracles.registries.curveDepositZapRegistry,
                                weth
                            ])];
                    case 23:
                        _6.sent();
                        _6.label = 24;
                    case 24:
                        if (!(((_s = this.adapters) === null || _s === void 0 ? void 0 : _s.curveGauge) !== undefined)) return [3 /*break*/, 26];
                        return [4 /*yield*/, this.adapters.curveGauge.deploy(this.signer, ensoPlatform.administration.whitelist, [new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.CURVE_ADDRESS_PROVIDER, [], this.signer), weth])];
                    case 25:
                        _6.sent();
                        _6.label = 26;
                    case 26:
                        if (!(((_t = this.adapters) === null || _t === void 0 ? void 0 : _t.synthetix) !== undefined)) return [3 /*break*/, 28];
                        return [4 /*yield*/, this.adapters.synthetix.deploy(this.signer, ensoPlatform.administration.whitelist, [new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.SYNTHETIX_ADDRESS_PROVIDER, [], this.signer), weth])];
                    case 27:
                        _6.sent();
                        _6.label = 28;
                    case 28:
                        if (!(((_u = this.adapters) === null || _u === void 0 ? void 0 : _u.uniswap) !== undefined)) return [3 /*break*/, 30];
                        return [4 /*yield*/, this.adapters.uniswap.deploy(this.signer, ensoPlatform.administration.whitelist, [uniswapV2Factory, weth])];
                    case 29:
                        _6.sent();
                        _6.label = 30;
                    case 30:
                        if (!(((_v = this.adapters) === null || _v === void 0 ? void 0 : _v.uniswapV2) !== undefined)) return [3 /*break*/, 32];
                        return [4 /*yield*/, this.adapters.uniswapV2.deploy(this.signer, ensoPlatform.administration.whitelist, [uniswapV2Factory, weth])];
                    case 31:
                        _6.sent();
                        _6.label = 32;
                    case 32:
                        if (!(((_w = this.adapters) === null || _w === void 0 ? void 0 : _w.uniswapV3) !== undefined)) return [3 /*break*/, 34];
                        return [4 /*yield*/, this.adapters.uniswapV3.deploy(this.signer, ensoPlatform.administration.whitelist, [ensoPlatform.oracles.registries.uniswapV3Registry, uniswapV3Router, weth])];
                    case 33:
                        _6.sent();
                        _6.label = 34;
                    case 34:
                        if (!(((_x = this.adapters) === null || _x === void 0 ? void 0 : _x.yearnV2) !== undefined)) return [3 /*break*/, 36];
                        return [4 /*yield*/, this.adapters.yearnV2.deploy(this.signer, ensoPlatform.administration.whitelist, [weth])];
                    case 35:
                        _6.sent();
                        _6.label = 36;
                    case 36:
                        if (!(((_y = this.adapters) === null || _y === void 0 ? void 0 : _y.leverage) !== undefined)) return [3 /*break*/, 38];
                        return [4 /*yield*/, this.adapters.leverage.deploy(this.signer, ensoPlatform.administration.whitelist, [
                                ((_z = this.adapters) === null || _z === void 0 ? void 0 : _z.uniswap.contract) || NULL_CONTRACT,
                                ((_0 = this.adapters) === null || _0 === void 0 ? void 0 : _0.aaveV2.contract) || NULL_CONTRACT,
                                ((_1 = this.adapters) === null || _1 === void 0 ? void 0 : _1.aaveV2Debt.contract) || NULL_CONTRACT,
                                usdc,
                                weth
                            ])];
                    case 37:
                        _6.sent();
                        _6.label = 38;
                    case 38:
                        fullRouterIndex = this.routers.findIndex(function (router) { return router.type == Routers.Full; });
                        if (!(((_2 = this.adapters) === null || _2 === void 0 ? void 0 : _2.metastrategy) !== undefined && fullRouterIndex > -1)) return [3 /*break*/, 40];
                        return [4 /*yield*/, this.adapters.metastrategy.deploy(this.signer, ensoPlatform.administration.whitelist, [ensoPlatform.controller, this.routers[fullRouterIndex].contract || NULL_CONTRACT, weth])];
                    case 39:
                        _6.sent();
                        _6.label = 40;
                    case 40:
                        // Safety check
                        if (this.adapters === undefined)
                            throw Error('Failed to add adapters');
                        if (this.routers === undefined)
                            throw Error('Failed to deploy routers');
                        return [2 /*return*/, new EnsoEnvironment(this.signer, this.defaults, ensoPlatform, this.adapters, this.routers, uniswapV2Factory, this.tokens, balancer)];
                }
            });
        });
    };
    return EnsoBuilder;
}());
exports.EnsoBuilder = EnsoBuilder;
// TODO: move adapters + routers into enso.Platform object
var EnsoEnvironment = /** @class */ (function () {
    function EnsoEnvironment(signer, defaults, platform, adapters, routers, uniswapV2Factory, tokens, balancer) {
        this.signer = signer;
        this.defaults = defaults;
        this.platform = platform;
        this.adapters = adapters;
        this.routers = routers;
        this.uniswapV2Factory = uniswapV2Factory;
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
    Adapters["AaveV2"] = "aavev2";
    Adapters["AaveV2Debt"] = "aavev2debt";
    Adapters["Balancer"] = "balancer";
    Adapters["Compound"] = "compound";
    Adapters["Curve"] = "curve";
    Adapters["CurveLP"] = "curvelp";
    Adapters["CurveGauge"] = "curvegauge";
    Adapters["Leverage"] = "leverage";
    Adapters["MetaStrategy"] = "metastrategy";
    Adapters["Synthetix"] = "synthetix";
    Adapters["Uniswap"] = "uniswap";
    Adapters["UniswapV2"] = "uniswapv2";
    Adapters["UniswapV3"] = "uniswapv3";
    Adapters["YEarnV2"] = "yearnv2";
})(Adapters = exports.Adapters || (exports.Adapters = {}));
var Adapter = /** @class */ (function () {
    function Adapter(adapterType) {
        var isAdapter = Object.values(Adapters).findIndex(function (v) { return v === adapterType.toLowerCase(); }) !== -1;
        if (isAdapter) {
            this.type = adapterType.toLowerCase();
        }
        else {
            throw Error('Invalid adapter selected!');
        }
    }
    Adapter.prototype.deploy = function (signer, whitelist, parameters) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            return __generator(this, function (_q) {
                switch (_q.label) {
                    case 0:
                        if (!(this.type === Adapters.AaveV2Debt)) return [3 /*break*/, 3];
                        if (!(parameters.length == 2)) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, deploy_1.deployAaveV2DebtAdapter(signer, parameters[0], parameters[1])];
                    case 1:
                        _a.contract = _q.sent();
                        _q.label = 2;
                    case 2: return [3 /*break*/, 41];
                    case 3:
                        if (!(this.type === Adapters.AaveV2)) return [3 /*break*/, 6];
                        if (!(parameters.length == 3)) return [3 /*break*/, 5];
                        _b = this;
                        return [4 /*yield*/, deploy_1.deployAaveV2Adapter(signer, parameters[0], parameters[1], parameters[2])];
                    case 4:
                        _b.contract = _q.sent();
                        _q.label = 5;
                    case 5: return [3 /*break*/, 41];
                    case 6:
                        if (!(this.type === Adapters.Balancer)) return [3 /*break*/, 9];
                        if (!(parameters.length == 2)) return [3 /*break*/, 8];
                        _c = this;
                        return [4 /*yield*/, deploy_1.deployBalancerAdapter(signer, parameters[0], parameters[1])];
                    case 7:
                        _c.contract = _q.sent();
                        _q.label = 8;
                    case 8: return [3 /*break*/, 41];
                    case 9:
                        if (!(this.type === Adapters.Compound)) return [3 /*break*/, 12];
                        if (!(parameters.length == 2)) return [3 /*break*/, 11];
                        _d = this;
                        return [4 /*yield*/, deploy_1.deployCompoundAdapter(signer, parameters[0], parameters[1])];
                    case 10:
                        _d.contract = _q.sent();
                        _q.label = 11;
                    case 11: return [3 /*break*/, 41];
                    case 12:
                        if (!(this.type === Adapters.Curve)) return [3 /*break*/, 15];
                        if (!(parameters.length == 2)) return [3 /*break*/, 14];
                        _e = this;
                        return [4 /*yield*/, deploy_1.deployCurveAdapter(signer, parameters[0], parameters[1])];
                    case 13:
                        _e.contract = _q.sent();
                        _q.label = 14;
                    case 14: return [3 /*break*/, 41];
                    case 15:
                        if (!(this.type === Adapters.CurveLP)) return [3 /*break*/, 18];
                        if (!(parameters.length == 3)) return [3 /*break*/, 17];
                        _f = this;
                        return [4 /*yield*/, deploy_1.deployCurveLPAdapter(signer, parameters[0], parameters[1], parameters[2])];
                    case 16:
                        _f.contract = _q.sent();
                        _q.label = 17;
                    case 17: return [3 /*break*/, 41];
                    case 18:
                        if (!(this.type === Adapters.CurveGauge)) return [3 /*break*/, 21];
                        if (!(parameters.length == 2)) return [3 /*break*/, 20];
                        _g = this;
                        return [4 /*yield*/, deploy_1.deployCurveGaugeAdapter(signer, parameters[0], parameters[1])];
                    case 19:
                        _g.contract = _q.sent();
                        _q.label = 20;
                    case 20: return [3 /*break*/, 41];
                    case 21:
                        if (!(this.type === Adapters.Leverage)) return [3 /*break*/, 24];
                        if (!(parameters.length == 5)) return [3 /*break*/, 23];
                        _h = this;
                        return [4 /*yield*/, deploy_1.deployLeverage2XAdapter(signer, parameters[0], parameters[1], parameters[2], parameters[3], parameters[4])];
                    case 22:
                        _h.contract = _q.sent();
                        _q.label = 23;
                    case 23: return [3 /*break*/, 41];
                    case 24:
                        if (!(this.type === Adapters.Synthetix)) return [3 /*break*/, 27];
                        if (!(parameters.length == 2)) return [3 /*break*/, 26];
                        _j = this;
                        return [4 /*yield*/, deploy_1.deploySynthetixAdapter(signer, parameters[0], parameters[1])];
                    case 25:
                        _j.contract = _q.sent();
                        _q.label = 26;
                    case 26: return [3 /*break*/, 41];
                    case 27:
                        if (!(this.type === Adapters.MetaStrategy)) return [3 /*break*/, 30];
                        if (!(parameters.length == 3)) return [3 /*break*/, 29];
                        _k = this;
                        return [4 /*yield*/, deploy_1.deployMetaStrategyAdapter(signer, parameters[0], parameters[1], parameters[2])];
                    case 28:
                        _k.contract = _q.sent();
                        _q.label = 29;
                    case 29: return [3 /*break*/, 41];
                    case 30:
                        if (!(this.type === Adapters.Uniswap)) return [3 /*break*/, 33];
                        if (!(parameters.length == 2)) return [3 /*break*/, 32];
                        _l = this;
                        return [4 /*yield*/, deploy_1.deployUniswapV2Adapter(signer, parameters[0], parameters[1])];
                    case 31:
                        _l.contract = _q.sent();
                        _q.label = 32;
                    case 32: return [3 /*break*/, 41];
                    case 33:
                        if (!(this.type === Adapters.UniswapV2)) return [3 /*break*/, 36];
                        if (!(parameters.length == 2)) return [3 /*break*/, 35];
                        _m = this;
                        return [4 /*yield*/, deploy_1.deployUniswapV2Adapter(signer, parameters[0], parameters[1])];
                    case 34:
                        _m.contract = _q.sent();
                        _q.label = 35;
                    case 35: return [3 /*break*/, 41];
                    case 36:
                        if (!(this.type === Adapters.UniswapV3)) return [3 /*break*/, 39];
                        if (!(parameters.length == 3)) return [3 /*break*/, 38];
                        _o = this;
                        return [4 /*yield*/, deploy_1.deployUniswapV3Adapter(signer, parameters[0], parameters[1], parameters[2])];
                    case 37:
                        _o.contract = _q.sent();
                        _q.label = 38;
                    case 38: return [3 /*break*/, 41];
                    case 39:
                        if (!(this.type === Adapters.YEarnV2)) return [3 /*break*/, 41];
                        if (!(parameters.length == 1)) return [3 /*break*/, 41];
                        _p = this;
                        return [4 /*yield*/, deploy_1.deployYEarnAdapter(signer, parameters[0])];
                    case 40:
                        _p.contract = _q.sent();
                        _q.label = 41;
                    case 41:
                        if (!(this.contract !== undefined)) return [3 /*break*/, 43];
                        return [4 /*yield*/, whitelist.connect(signer).approve(this.contract.address)];
                    case 42:
                        _q.sent();
                        _q.label = 43;
                    case 43: return [2 /*return*/];
                }
            });
        });
    };
    return Adapter;
}());
exports.Adapter = Adapter;
var Routers;
(function (Routers) {
    Routers[Routers["Multicall"] = 0] = "Multicall";
    Routers[Routers["Loop"] = 1] = "Loop";
    Routers[Routers["Full"] = 2] = "Full";
    Routers[Routers["Batch"] = 3] = "Batch";
})(Routers = exports.Routers || (exports.Routers = {}));
// TODO: implement encoding for each Router (chain calldata for each type of router MulticallRouter is IRouter, LoopRouter is IRouter etc..)
var Router = /** @class */ (function () {
    function Router(routerType) {
        switch (routerType.toLowerCase()) {
            case 'generic' || 'genericrouter' || 'multicall' || 'multicallrouter':
                this.type = Routers.Multicall;
                break;
            case 'loop' || 'looprouter':
                this.type = Routers.Loop;
                break;
            case 'full' || 'fullrouter':
                this.type = Routers.Full;
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
                        if (!(this.type == Routers.Multicall)) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, deploy_1.deployMulticallRouter(signer, controller)];
                    case 1:
                        _a.contract = _e.sent();
                        return [3 /*break*/, 8];
                    case 2:
                        if (!(this.type == Routers.Full)) return [3 /*break*/, 4];
                        _b = this;
                        return [4 /*yield*/, deploy_1.deployFullRouter(signer, new ethers_1.Contract(constants_1.MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], hardhat_1.ethers.provider), controller, library)];
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
