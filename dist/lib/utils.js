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
exports.getDeadline = exports.getMaxTick = exports.getMinTick = exports.encodePriceSqrt = exports.increaseTime = exports.ESTIMATOR_CATEGORY = exports.ITEM_CATEGORY = exports.TIMELOCK_CATEGORY = exports.MAINNET_ADDRESSES = exports.DEFAULT_DEPOSIT_SLIPPAGE = exports.ORACLE_TIME_WINDOW = exports.UNI_V3_FEE = exports.DIVISOR = exports.FEE = void 0;
var bignumber_js_1 = __importDefault(require("bignumber.js"));
var hre = require('hardhat');
var ethers_1 = require("ethers");
var waffle = hre.waffle;
var provider = waffle.provider._hardhatNetwork.provider;
exports.FEE = 997;
exports.DIVISOR = 1000;
exports.UNI_V3_FEE = 3000;
exports.ORACLE_TIME_WINDOW = 1;
exports.DEFAULT_DEPOSIT_SLIPPAGE = 995;
exports.MAINNET_ADDRESSES = {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    SUSD: '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
    USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    UNISWAP: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    BALANCER_REGISTRY: '0x65e67cbc342712DF67494ACEfc06fe951EE93982',
    BALANCER_FACTORY: '0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd',
    AAVE_ADDRESS_PROVIDER: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
    CURVE_ADDRESS_PROVIDER: '0x0000000022D53366457F9d5E68Ec105046FC4383',
    SYNTHETIX_ADDRESS_PROVIDER: '0x823bE81bbF96BEc0e25CA13170F5AaCb5B79ba83',
    COMPOUND_COMPTROLLER: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B'
};
var TIMELOCK_CATEGORY;
(function (TIMELOCK_CATEGORY) {
    TIMELOCK_CATEGORY[TIMELOCK_CATEGORY["RESTRUCTURE"] = 0] = "RESTRUCTURE";
    TIMELOCK_CATEGORY[TIMELOCK_CATEGORY["THRESHOLD"] = 1] = "THRESHOLD";
    TIMELOCK_CATEGORY[TIMELOCK_CATEGORY["REBALANCE_SLIPPAGE"] = 2] = "REBALANCE_SLIPPAGE";
    TIMELOCK_CATEGORY[TIMELOCK_CATEGORY["RESTRUCTURE_SLIPPAGE"] = 3] = "RESTRUCTURE_SLIPPAGE";
    TIMELOCK_CATEGORY[TIMELOCK_CATEGORY["TIMELOCK"] = 4] = "TIMELOCK";
    TIMELOCK_CATEGORY[TIMELOCK_CATEGORY["PERFORMANCE"] = 5] = "PERFORMANCE";
})(TIMELOCK_CATEGORY = exports.TIMELOCK_CATEGORY || (exports.TIMELOCK_CATEGORY = {}));
var ITEM_CATEGORY;
(function (ITEM_CATEGORY) {
    ITEM_CATEGORY[ITEM_CATEGORY["BASIC"] = 0] = "BASIC";
    ITEM_CATEGORY[ITEM_CATEGORY["SYNTH"] = 1] = "SYNTH";
    ITEM_CATEGORY[ITEM_CATEGORY["DEBT"] = 2] = "DEBT";
    ITEM_CATEGORY[ITEM_CATEGORY["RESERVE"] = 3] = "RESERVE";
})(ITEM_CATEGORY = exports.ITEM_CATEGORY || (exports.ITEM_CATEGORY = {}));
var ESTIMATOR_CATEGORY;
(function (ESTIMATOR_CATEGORY) {
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["DEFAULT_ORACLE"] = 0] = "DEFAULT_ORACLE";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["CHAINLINK_ORACLE"] = 1] = "CHAINLINK_ORACLE";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["STRATEGY"] = 2] = "STRATEGY";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["BLOCKED"] = 3] = "BLOCKED";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["AAVE_V1"] = 4] = "AAVE_V1";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["AAVE_V2"] = 5] = "AAVE_V2";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["AAVE_DEBT"] = 6] = "AAVE_DEBT";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["BALANCER"] = 7] = "BALANCER";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["COMPOUND"] = 8] = "COMPOUND";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["CURVE"] = 9] = "CURVE";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["CURVE_GAUGE"] = 10] = "CURVE_GAUGE";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["SUSHI_LP"] = 11] = "SUSHI_LP";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["SUSHI_FARM"] = 12] = "SUSHI_FARM";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["UNISWAP_V2_LP"] = 13] = "UNISWAP_V2_LP";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["UNISWAP_V3_LP"] = 14] = "UNISWAP_V3_LP";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["YEARN_V1"] = 15] = "YEARN_V1";
    ESTIMATOR_CATEGORY[ESTIMATOR_CATEGORY["YEARN_V2"] = 16] = "YEARN_V2";
})(ESTIMATOR_CATEGORY = exports.ESTIMATOR_CATEGORY || (exports.ESTIMATOR_CATEGORY = {}));
function increaseTime(seconds) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, provider.send('evm_increaseTime', [seconds])];
                case 1:
                    _a.sent();
                    return [2 /*return*/, provider.send('evm_mine')];
            }
        });
    });
}
exports.increaseTime = increaseTime;
function encodePriceSqrt(reserve1, reserve0) {
    return ethers_1.BigNumber.from(new bignumber_js_1.default(reserve1.toString())
        .div(reserve0.toString())
        .sqrt()
        .multipliedBy(new bignumber_js_1.default(2).pow(96))
        .integerValue(3)
        .toFixed());
}
exports.encodePriceSqrt = encodePriceSqrt;
function getMinTick(tickSpacing) {
    return Math.ceil(-887272 / tickSpacing) * tickSpacing;
}
exports.getMinTick = getMinTick;
function getMaxTick(tickSpacing) {
    return Math.floor(887272 / tickSpacing) * tickSpacing;
}
exports.getMaxTick = getMaxTick;
function getDeadline(secondsInFuture) {
    return __awaiter(this, void 0, void 0, function () {
        var blockNumber, block;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, provider.send('eth_blockNumber')];
                case 1:
                    blockNumber = _a.sent();
                    return [4 /*yield*/, provider.send('eth_getBlockByNumber', [blockNumber, true])];
                case 2:
                    block = _a.sent();
                    return [2 /*return*/, ethers_1.BigNumber.from(block.timestamp).add(secondsInFuture)];
            }
        });
    });
}
exports.getDeadline = getDeadline;
