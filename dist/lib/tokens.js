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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tokens = void 0;
var utils_1 = require("./utils");
var Tokens = /** @class */ (function () {
    function Tokens() {
        // Basic Tokens
        this.weth = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
        this.wbtc = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
        this.dai = '0x6b175474e89094c44da98b954eedeac495271d0f';
        this.usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        this.usdt = '0xdac17f958d2ee523a2206206994597c13d831ec7';
        this.usdp = '0x1456688345527bE1f37E9e627DA0837D6f08C925';
        this.tusd = '0x0000000000085d4780B73119b644AE5ecd22b376';
        this.usdn = '0x674C6Ad92Fd080e4004b2312b45f796a192D27a0';
        this.link = '0x514910771AF9Ca656af840dff83E8264EcF986CA';
        this.crv = '0xd533a949740bb3306d119cc777fa900ba034cd52';
        this.knc = '0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202';
        // Ren
        this.renBTC = '0xeb4c2781e4eba804ce9a9803c67d0893436bb27d';
        // Synthetix
        this.sUSD = '0x57ab1ec28d129707052df4df418d58a2d46d5f51';
        this.sEUR = '0xd71ecff9342a5ced620049e616c5035f1db98620';
        this.sETH = '0x5e74c9036fb86bd7ecdcb084a0673efc32ea31cb';
        this.sBTC = '0xfe18be6b3bd88a2d2a7f928d00292e7a9963cfc6';
        this.sAAVE = '0xd2df355c19471c8bd7d8a3aa27ff4e26a21b4076';
        this.sLINK = '0xbBC455cb4F1B9e4bFC4B73970d360c8f032EfEE6';
        this.sDOT = '0x1715ac0743102bf5cd58efbb6cf2dc2685d967b6';
        this.sADA = '0xe36e2d3c7c34281fa3bc737950a68571736880a1';
        // Aave Tokens
        this.aWETH = '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e';
        this.aWBTC = '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656';
        this.aDAI = '0x028171bCA77440897B824Ca71D1c56caC55b68A3';
        this.aUSDC = '0xBcca60bB61934080951369a648Fb03DF4F96263C';
        this.aUSDT = '0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811';
        this.aCRV = '0x8dAE6Cb04688C62d939ed9B68d32Bc62e49970b1';
        // Aave Debt Tokens
        this.debtDAI = '0x778A13D3eeb110A4f7bb6529F99c000119a08E92';
        this.debtUSDC = '0xE4922afAB0BbaDd8ab2a88E0C79d884Ad337fcA6';
        this.debtWBTC = '0x51B039b9AFE64B78758f8Ef091211b5387eA717c';
        this.debtWETH = '0x4e977830ba4bd783C0BB7F15d3e243f73FF57121';
        // Compound Tokens
        this.cDAI = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
        this.cUSDC = '0x39aa39c021dfbae8fac545936693ac917d5e7563';
        // Curve LP Tokens
        this.crv3 = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490';
        this.crvTriCrypto = '0xcA3d75aC011BF5aD07a98d02f18225F9bD9A6BDF';
        this.crvTriCrypto2 = '0xc4ad29ba4b3c580e6d59105fff484999997675ff';
        this.crvUSDP = '0x7Eb40E450b9655f4B3cC4259BCC731c63ff55ae6';
        this.crvSUSD = '0xC25a3A3b969415c80451098fa907EC722572917F';
        this.crvAAVE = '0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900';
        this.crvSAAVE = '0x02d341CcB60fAaf662bC0554d13778015d1b285C';
        this.crvLINK = '0xcee60cfa923170e4f8204ae08b4fa6a3f5656f3a';
        this.crvCOMP = '0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2';
        this.crvY = '0xdF5e0e81Dff6FAF3A7e52BA697820c5e32D806A8';
        this.crvUSDN = '0x4f3E8F405CF5aFC05D68142F3783bDfE13811522';
        this.crvSETH = '0xA3D87FffcE63B53E0d54fAa1cc983B7eB0b74A9c';
        this.crvREN = '0x49849C98ae39Fff122806C06791Fa73784FB3675';
        // Curve Gauge Tokens
        this.crvUSDPGauge = '0x055be5DDB7A925BfEF3417FC157f53CA77cA7222';
        this.crvSUSDGauge = '0xA90996896660DEcC6E997655E065b23788857849';
        this.crvAAVEGauge = '0xd662908ADA2Ea1916B3318327A97eB18aD588b5d';
        this.crvSAAVEGauge = '0x462253b8F74B72304c145DB0e4Eebd326B22ca39';
        this.crvLINKGauge = '0xFD4D8a17df4C27c1dD245d153ccf4499e806C87D';
        this.crvCOMPGauge = '0x7ca5b0a2910B33e9759DC7dDB0413949071D7575';
        this.crvYGauge = '0xFA712EE4788C042e2B7BB55E6cb8ec569C4530c1';
        // YEarn Tokens
        this.ycrv3 = '0x84E13785B5a27879921D6F685f041421C7F482dA';
        this.ycrvTriCrypto2 = '0xE537B5cc158EB71037D4125BDD7538421981E6AA';
        this.ycrvUSDP = '0xC4dAf3b5e2A9e93861c3FBDd25f1e943B8D87417';
        this.ycrvSUSD = '0x5a770DbD3Ee6bAF2802D29a901Ef11501C44797A';
        this.yDAI = '0xdA816459F1AB5631232FE5e97a05BBBb94970c95';
        this.yUSDC = '0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE';
        this.yWBTC = '0xA696a63cc78DfFa1a63E9E50587C197387FF6C7E';
    }
    Tokens.prototype.registerTokens = function (owner, strategyFactory, uniswapV3Registry, chainlinkRegistry, curveDepositZapRegistry) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.all([
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.RESERVE, utils_1.ESTIMATOR_CATEGORY.DEFAULT_ORACLE, this.weth),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.RESERVE, utils_1.ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, this.sUSD),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, this.knc),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.SYNTH, utils_1.ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, this.sEUR),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.SYNTH, utils_1.ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, this.sLINK),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.SYNTH, utils_1.ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, this.sETH),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.SYNTH, utils_1.ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, this.sAAVE),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.SYNTH, utils_1.ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, this.sBTC),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.SYNTH, utils_1.ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, this.sDOT),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.SYNTH, utils_1.ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, this.sADA),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.AAVE_V2, this.aWETH),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.AAVE_V2, this.aWBTC),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.AAVE_V2, this.aDAI),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.AAVE_V2, this.aUSDC),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.AAVE_V2, this.aUSDT),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.AAVE_V2, this.aCRV),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.DEBT, utils_1.ESTIMATOR_CATEGORY.AAVE_DEBT, this.debtDAI),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.DEBT, utils_1.ESTIMATOR_CATEGORY.AAVE_DEBT, this.debtUSDC),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.DEBT, utils_1.ESTIMATOR_CATEGORY.AAVE_DEBT, this.debtWBTC),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.DEBT, utils_1.ESTIMATOR_CATEGORY.AAVE_DEBT, this.debtWETH),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.COMPOUND, this.cDAI),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.COMPOUND, this.cUSDC),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE, this.crv3),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE, this.crvTriCrypto2),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE, this.crvUSDP),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE, this.crvSUSD),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE, this.crvAAVE),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE, this.crvSAAVE),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE, this.crvLINK),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE, this.crvCOMP),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE, this.crvUSDN),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE, this.crvSETH),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE, this.crvREN),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvUSDPGauge),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvSUSDGauge),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvAAVEGauge),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvSAAVEGauge),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvLINKGauge),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.YEARN_V2, this.ycrv3),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.YEARN_V2, this.ycrvTriCrypto2),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.YEARN_V2, this.ycrvUSDP),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.YEARN_V2, this.ycrvSUSD),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.YEARN_V2, this.yDAI),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.YEARN_V2, this.yUSDC),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.YEARN_V2, this.yWBTC),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.BLOCKED, this.crvTriCrypto),
                            strategyFactory.connect(owner).addItemToRegistry(utils_1.ITEM_CATEGORY.BASIC, utils_1.ESTIMATOR_CATEGORY.BLOCKED, '0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E') //TUSD second address
                        ])];
                    case 1:
                        _a.sent();
                        if (!uniswapV3Registry) return [3 /*break*/, 7];
                        return [4 /*yield*/, uniswapV3Registry.connect(owner).addPool(this.wbtc, this.weth, '3000')]; //0.3%
                    case 2:
                        _a.sent(); //0.3%
                        return [4 /*yield*/, uniswapV3Registry.connect(owner).addPool(this.usdc, this.weth, '3000')]; //0.3%
                    case 3:
                        _a.sent(); //0.3%
                        return [4 /*yield*/, uniswapV3Registry.connect(owner).addPool(this.usdt, this.weth, '3000')]; //0.3%
                    case 4:
                        _a.sent(); //0.3%
                        return [4 /*yield*/, uniswapV3Registry.connect(owner).addPool(this.dai, this.weth, '3000')]; //0.3%
                    case 5:
                        _a.sent(); //0.3%
                        return [4 /*yield*/, uniswapV3Registry.connect(owner).addPool(this.crv, this.weth, '10000')]; //1%
                    case 6:
                        _a.sent(); //1%
                        _a.label = 7;
                    case 7:
                        if (!chainlinkRegistry) return [3 /*break*/, 17];
                        return [4 /*yield*/, chainlinkRegistry.connect(owner).addOracle(this.sUSD, this.weth, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', true)];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, chainlinkRegistry.connect(owner).addOracle(this.sEUR, this.sUSD, '0xb49f677943BC038e9857d61E7d053CaA2C1734C1', false)];
                    case 9:
                        _a.sent();
                        return [4 /*yield*/, chainlinkRegistry.connect(owner).addOracle(this.sLINK, this.weth, '0xDC530D9457755926550b59e8ECcdaE7624181557', false)];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, chainlinkRegistry.connect(owner).addOracle(this.knc, this.sUSD, '0xf8ff43e991a81e6ec886a3d281a2c6cc19ae70fc', false)];
                    case 11:
                        _a.sent();
                        return [4 /*yield*/, chainlinkRegistry.connect(owner).addOracle(this.sETH, this.sUSD, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', false)];
                    case 12:
                        _a.sent();
                        return [4 /*yield*/, chainlinkRegistry.connect(owner).addOracle(this.sAAVE, this.weth, '0x6df09e975c830ecae5bd4ed9d90f3a95a4f88012', false)];
                    case 13:
                        _a.sent();
                        return [4 /*yield*/, chainlinkRegistry.connect(owner).addOracle(this.sBTC, this.weth, '0xdeb288f737066589598e9214e782fa5a8ed689e8', false)];
                    case 14:
                        _a.sent();
                        return [4 /*yield*/, chainlinkRegistry.connect(owner).addOracle(this.sDOT, this.sUSD, '0x1c07afb8e2b827c5a4739c6d59ae3a5035f28734', false)];
                    case 15:
                        _a.sent();
                        return [4 /*yield*/, chainlinkRegistry.connect(owner).addOracle(this.sADA, this.sUSD, '0xae48c91df1fe419994ffda27da09d5ac69c30f55', false)];
                    case 16:
                        _a.sent();
                        _a.label = 17;
                    case 17:
                        if (!curveDepositZapRegistry) return [3 /*break*/, 22];
                        return [4 /*yield*/, curveDepositZapRegistry.connect(owner).addZap(this.crvSUSD, '0xfcba3e75865d2d561be8d220616520c171f12851', 0)];
                    case 18:
                        _a.sent();
                        return [4 /*yield*/, curveDepositZapRegistry.connect(owner).addZap(this.crvUSDP, '0x3c8cAee4E09296800f8D29A68Fa3837e2dae4940', 0)];
                    case 19:
                        _a.sent();
                        return [4 /*yield*/, curveDepositZapRegistry.connect(owner).addZap(this.crvCOMP, '0xeb21209ae4c2c9ff2a86aca31e123764a3b6bc06', 0)];
                    case 20:
                        _a.sent();
                        return [4 /*yield*/, curveDepositZapRegistry.connect(owner).addZap(this.crvTriCrypto2, '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46', 1)];
                    case 21:
                        _a.sent();
                        _a.label = 22;
                    case 22: return [2 /*return*/];
                }
            });
        });
    };
    return Tokens;
}());
exports.Tokens = Tokens;
