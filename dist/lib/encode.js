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
exports.encodePath = exports.encodeEthTransfer = exports.encodeWethDeposit = exports.encodeApprove = exports.encodeTransferFrom = exports.encodeTransfer = exports.encodeSettleTransferFrom = exports.encodeSettleTransfer = exports.encodeSettleSwap = exports.encodeUniswapPairSwap = exports.encodeDelegateSwap = exports.encodeSwap = exports.getRebalanceRange = exports.getExpectedTokenValue = exports.calculateAddress = exports.preparePermit = exports.prepareDepositMulticall = exports.prepareRebalanceMulticall = exports.prepareUniswapSwap = exports.StrategyBuilder = exports.FEE_SIZE = void 0;
var ethers_1 = require("ethers");
var utils_1 = require("./utils");
var ERC20_json_1 = __importDefault(require("@uniswap/v2-periphery/build/ERC20.json"));
var UniswapV2Pair_json_1 = __importDefault(require("@uniswap/v2-core/build/UniswapV2Pair.json"));
var hre = require('hardhat');
var ethers = hre.ethers;
var constants = ethers.constants, getContractFactory = ethers.getContractFactory;
var AddressZero = constants.AddressZero;
exports.FEE_SIZE = 3;
// TODO: make builder pattern
var StrategyBuilder = /** @class */ (function () {
    function StrategyBuilder(positions, adapter) {
        var _this = this;
        this.tokens = [];
        this.percentages = [];
        this.adapters = [];
        positions
            .sort(function (a, b) {
            var aNum = ethers.BigNumber.from(a.token);
            var bNum = ethers.BigNumber.from(b.token);
            return aNum.sub(bNum);
        })
            .forEach(function (position) {
            _this.tokens.push(position.token);
            _this.percentages.push(position.percentage);
            _this.adapters.push(adapter);
        });
    }
    return StrategyBuilder;
}());
exports.StrategyBuilder = StrategyBuilder;
function prepareUniswapSwap(router, adapter, factory, from, to, amount, tokenIn, tokenOut) {
    return __awaiter(this, void 0, void 0, function () {
        var calls, pairAddress, pair, received, tokenInNum, tokenOutNum;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    calls = [];
                    return [4 /*yield*/, factory.getPair(tokenIn.address, tokenOut.address)];
                case 1:
                    pairAddress = _a.sent();
                    if (!(pairAddress !== AddressZero)) return [3 /*break*/, 4];
                    return [4 /*yield*/, ethers.getContractAt(UniswapV2Pair_json_1.default.abi, pairAddress)
                        //Transfer input token to pair address
                    ];
                case 2:
                    pair = _a.sent();
                    //Transfer input token to pair address
                    if (from.toLowerCase() === router.address.toLowerCase()) {
                        calls.push(encodeTransfer(tokenIn, pairAddress, amount));
                    }
                    else {
                        calls.push(encodeTransferFrom(tokenIn, from, pairAddress, amount));
                    }
                    return [4 /*yield*/, adapter.swapPrice(amount, tokenIn.address, tokenOut.address)];
                case 3:
                    received = _a.sent();
                    tokenInNum = ethers.BigNumber.from(tokenIn.address);
                    tokenOutNum = ethers.BigNumber.from(tokenOut.address);
                    if (tokenInNum.lt(tokenOutNum)) {
                        calls.push(encodeUniswapPairSwap(pair, ethers_1.BigNumber.from(0), received, to));
                    }
                    else if (tokenOutNum.lt(tokenInNum)) {
                        calls.push(encodeUniswapPairSwap(pair, received, ethers_1.BigNumber.from(0), to));
                    }
                    _a.label = 4;
                case 4: return [2 /*return*/, calls];
            }
        });
    });
}
exports.prepareUniswapSwap = prepareUniswapSwap;
function prepareRebalanceMulticall(strategy, controller, router, adapter, oracle, weth) {
    return __awaiter(this, void 0, void 0, function () {
        var calls, buyLoop, tokens, _a, total, estimates, wethInStrategy, i, token, estimatedValue, expectedValue, _b, _c, rebalanceRange, _d, _e, diff, expected, i, token, estimatedValue, expectedValue, _f, _g, rebalanceRange, _h, _j, diff, expected;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    calls = [];
                    buyLoop = [];
                    return [4 /*yield*/, strategy.items()];
                case 1:
                    tokens = _k.sent();
                    return [4 /*yield*/, oracle.estimateTotal(strategy.address, tokens)];
                case 2:
                    _a = _k.sent(), total = _a[0], estimates = _a[1];
                    wethInStrategy = false;
                    i = 0;
                    _k.label = 3;
                case 3:
                    if (!(i < tokens.length)) return [3 /*break*/, 13];
                    return [4 /*yield*/, ethers.getContractAt(ERC20_json_1.default.abi, tokens[i])];
                case 4:
                    token = _k.sent();
                    estimatedValue = ethers.BigNumber.from(estimates[i]);
                    _c = (_b = ethers.BigNumber).from;
                    return [4 /*yield*/, getExpectedTokenValue(total, token.address, strategy)];
                case 5:
                    expectedValue = _c.apply(_b, [_k.sent()]);
                    _e = (_d = ethers.BigNumber).from;
                    return [4 /*yield*/, getRebalanceRange(expectedValue, controller, strategy)];
                case 6:
                    rebalanceRange = _e.apply(_d, [_k.sent()]);
                    if (!(token.address.toLowerCase() != weth.address.toLowerCase())) return [3 /*break*/, 11];
                    if (!estimatedValue.gt(expectedValue.add(rebalanceRange))) return [3 /*break*/, 9];
                    return [4 /*yield*/, adapter.spotPrice(estimatedValue.sub(expectedValue), weth.address, token.address)];
                case 7:
                    diff = _k.sent();
                    return [4 /*yield*/, adapter.swapPrice(diff, token.address, weth.address)];
                case 8:
                    expected = _k.sent();
                    calls.push(encodeDelegateSwap(router, adapter.address, diff, expected, token.address, weth.address, strategy.address, strategy.address));
                    return [3 /*break*/, 10];
                case 9:
                    buyLoop.push({
                        token: tokens[i],
                        estimate: estimates[i],
                    });
                    _k.label = 10;
                case 10: return [3 /*break*/, 12];
                case 11:
                    wethInStrategy = true;
                    _k.label = 12;
                case 12:
                    i++;
                    return [3 /*break*/, 3];
                case 13:
                    i = 0;
                    _k.label = 14;
                case 14:
                    if (!(i < buyLoop.length)) return [3 /*break*/, 21];
                    return [4 /*yield*/, ethers.getContractAt(ERC20_json_1.default.abi, buyLoop[i].token)];
                case 15:
                    token = _k.sent();
                    estimatedValue = ethers.BigNumber.from(buyLoop[i].estimate);
                    if (!(token.address.toLowerCase() != weth.address.toLowerCase())) return [3 /*break*/, 20];
                    if (!(!wethInStrategy && i == buyLoop.length - 1)) return [3 /*break*/, 16];
                    // The last token must use up the remainder of funds, but since balance is unknown, we call this function which does the final cleanup
                    calls.push(encodeSettleSwap(router, adapter.address, weth.address, token.address, strategy.address, strategy.address));
                    return [3 /*break*/, 20];
                case 16:
                    _g = (_f = ethers.BigNumber).from;
                    return [4 /*yield*/, getExpectedTokenValue(total, token.address, strategy)];
                case 17:
                    expectedValue = _g.apply(_f, [_k.sent()]);
                    _j = (_h = ethers.BigNumber).from;
                    return [4 /*yield*/, getRebalanceRange(expectedValue, controller, strategy)];
                case 18:
                    rebalanceRange = _j.apply(_h, [_k.sent()]);
                    if (!estimatedValue.lt(expectedValue.sub(rebalanceRange))) return [3 /*break*/, 20];
                    diff = expectedValue.sub(estimatedValue);
                    return [4 /*yield*/, adapter.swapPrice(diff, weth.address, token.address)];
                case 19:
                    expected = _k.sent();
                    calls.push(encodeDelegateSwap(router, adapter.address, diff, expected, weth.address, token.address, strategy.address, strategy.address));
                    _k.label = 20;
                case 20:
                    i++;
                    return [3 /*break*/, 14];
                case 21: return [2 /*return*/, calls];
            }
        });
    });
}
exports.prepareRebalanceMulticall = prepareRebalanceMulticall;
function prepareDepositMulticall(strategy, controller, router, adapter, weth, total, tokens, percentages) {
    return __awaiter(this, void 0, void 0, function () {
        var calls, wethInStrategy, i, token, amount, expected;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    calls = [];
                    wethInStrategy = false;
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < tokens.length)) return [3 /*break*/, 8];
                    return [4 /*yield*/, ethers.getContractAt(ERC20_json_1.default.abi, tokens[i])];
                case 2:
                    token = _a.sent();
                    if (!(token.address.toLowerCase() !== weth.address.toLowerCase())) return [3 /*break*/, 6];
                    if (!(!wethInStrategy && i == tokens.length - 1)) return [3 /*break*/, 3];
                    calls.push(encodeSettleSwap(router, adapter.address, weth.address, token.address, controller.address, strategy.address));
                    return [3 /*break*/, 5];
                case 3:
                    amount = ethers_1.BigNumber.from(total).mul(percentages[i]).div(utils_1.DIVISOR);
                    return [4 /*yield*/, adapter.swapPrice(amount, weth.address, token.address)
                        //console.log('Buy token: ', i, ' estimated value: ', 0, ' expected value: ', amount.toString())
                    ];
                case 4:
                    expected = _a.sent();
                    //console.log('Buy token: ', i, ' estimated value: ', 0, ' expected value: ', amount.toString())
                    calls.push(encodeDelegateSwap(router, adapter.address, amount, expected, weth.address, token.address, controller.address, strategy.address));
                    _a.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    wethInStrategy = true;
                    _a.label = 7;
                case 7:
                    i++;
                    return [3 /*break*/, 1];
                case 8:
                    if (wethInStrategy) {
                        calls.push(encodeSettleTransferFrom(router, weth.address, controller.address, strategy.address));
                    }
                    return [2 /*return*/, calls];
            }
        });
    });
}
exports.prepareDepositMulticall = prepareDepositMulticall;
function preparePermit(strategy, owner, spender, value, deadline) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, name, chainId, nonce, version, typedData, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        strategy.name(),
                        strategy.chainId(),
                        strategy.nonces(owner.address),
                        strategy.version()
                    ])];
                case 1:
                    _a = _d.sent(), name = _a[0], chainId = _a[1], nonce = _a[2], version = _a[3];
                    typedData = {
                        types: {
                            EIP712Domain: [
                                { name: 'name', type: 'string' },
                                { name: 'version', type: 'string' },
                                { name: 'chainId', type: 'uint256' },
                                { name: 'verifyingContract', type: 'address' },
                            ],
                            Permit: [
                                { name: 'owner', type: 'address' },
                                { name: 'spender', type: 'address' },
                                { name: 'value', type: 'uint256' },
                                { name: 'nonce', type: 'uint256' },
                                { name: 'deadline', type: 'uint256' },
                            ],
                        },
                        primaryType: 'Permit',
                        domain: {
                            name: name,
                            version: version,
                            chainId: chainId.toString(),
                            verifyingContract: strategy.address,
                        },
                        message: {
                            owner: owner.address,
                            spender: spender.address,
                            value: value.toString(),
                            nonce: nonce.toString(),
                            deadline: deadline.toString(),
                        },
                    };
                    if (owner.provider === undefined)
                        return [2 /*return*/, Error('Signer isnt connected to the network')];
                    _c = (_b = ethers.utils).splitSignature;
                    return [4 /*yield*/, ethers.provider.send('eth_signTypedData', [owner.address, typedData])];
                case 2: return [2 /*return*/, _c.apply(_b, [_d.sent()])];
            }
        });
    });
}
exports.preparePermit = preparePermit;
function calculateAddress(strategyFactory, creator, name, symbol, tokens, percentages) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, salt, implementation, version, controller, Proxy, Strategy, deployTx;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        strategyFactory.salt(creator, name, symbol),
                        strategyFactory.implementation(),
                        strategyFactory.version(),
                        strategyFactory.controller(),
                    ])];
                case 1:
                    _a = _b.sent(), salt = _a[0], implementation = _a[1], version = _a[2], controller = _a[3];
                    return [4 /*yield*/, getContractFactory('TransparentUpgradeableProxy')];
                case 2:
                    Proxy = _b.sent();
                    return [4 /*yield*/, getContractFactory('Strategy')];
                case 3:
                    Strategy = _b.sent();
                    deployTx = Proxy.getDeployTransaction(implementation, strategyFactory.address, Strategy.interface.encodeFunctionData('initialize', [
                        name,
                        symbol,
                        version,
                        controller,
                        creator,
                        tokens,
                        percentages,
                    ]));
                    return [2 /*return*/, ethers.utils.getCreate2Address(strategyFactory.address, salt, ethers.utils.keccak256(deployTx.data))];
            }
        });
    });
}
exports.calculateAddress = calculateAddress;
function getExpectedTokenValue(total, token, strategy) {
    return __awaiter(this, void 0, void 0, function () {
        var percentage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, strategy.percentage(token)];
                case 1:
                    percentage = _a.sent();
                    return [2 /*return*/, ethers.BigNumber.from(total).mul(percentage).div(utils_1.DIVISOR)];
            }
        });
    });
}
exports.getExpectedTokenValue = getExpectedTokenValue;
function getRebalanceRange(expectedValue, controller, strategy) {
    return __awaiter(this, void 0, void 0, function () {
        var threshold;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, controller.rebalanceThreshold(strategy.address)];
                case 1:
                    threshold = _a.sent();
                    return [2 /*return*/, ethers.BigNumber.from(expectedValue).mul(threshold).div(utils_1.DIVISOR)];
            }
        });
    });
}
exports.getRebalanceRange = getRebalanceRange;
function encodeSwap(adapter, amountTokens, minTokens, tokenIn, tokenOut, accountFrom, accountTo) {
    var swapEncoded = adapter.interface.encodeFunctionData('swap', [
        amountTokens,
        minTokens,
        tokenIn,
        tokenOut,
        accountFrom,
        accountTo,
        '0x',
        '0x',
    ]);
    var msgValue = tokenIn === AddressZero ? amountTokens : ethers_1.BigNumber.from(0);
    return { target: adapter.address, callData: swapEncoded, value: msgValue };
}
exports.encodeSwap = encodeSwap;
function encodeDelegateSwap(router, adapter, amount, minTokens, tokenIn, tokenOut, accountFrom, accountTo) {
    var delegateSwapEncoded = router.interface.encodeFunctionData('delegateSwap', [
        adapter,
        amount,
        minTokens,
        tokenIn,
        tokenOut,
        accountFrom,
        accountTo,
        '0x',
    ]);
    return { target: router.address, callData: delegateSwapEncoded, value: ethers_1.BigNumber.from(0) };
}
exports.encodeDelegateSwap = encodeDelegateSwap;
function encodeUniswapPairSwap(pair, amount0Out, amount1Out, accountTo) {
    var pairSwapEncoded = pair.interface.encodeFunctionData('swap', [amount0Out, amount1Out, accountTo, '0x']);
    return { target: pair.address, callData: pairSwapEncoded, value: ethers_1.BigNumber.from(0) };
}
exports.encodeUniswapPairSwap = encodeUniswapPairSwap;
function encodeSettleSwap(router, adapter, tokenIn, tokenOut, accountFrom, accountTo) {
    var settleSwapEncoded = router.interface.encodeFunctionData('settleSwap', [
        adapter,
        tokenIn,
        tokenOut,
        accountFrom,
        accountTo,
        '0x',
    ]);
    return { target: router.address, callData: settleSwapEncoded, value: ethers_1.BigNumber.from(0) };
}
exports.encodeSettleSwap = encodeSettleSwap;
function encodeSettleTransfer(router, token, accountTo) {
    var settleTransferEncoded = router.interface.encodeFunctionData('settleTransfer', [token, accountTo]);
    return { target: router.address, callData: settleTransferEncoded, value: ethers_1.BigNumber.from(0) };
}
exports.encodeSettleTransfer = encodeSettleTransfer;
function encodeSettleTransferFrom(router, token, accountFrom, accountTo) {
    var settleTransferFromEncoded = router.interface.encodeFunctionData('settleTransferFrom', [
        token,
        accountFrom,
        accountTo,
    ]);
    return { target: router.address, callData: settleTransferFromEncoded, value: ethers_1.BigNumber.from(0) };
}
exports.encodeSettleTransferFrom = encodeSettleTransferFrom;
function encodeTransfer(token, to, amount) {
    var transferEncoded = token.interface.encodeFunctionData('transfer', [to, amount]);
    return { target: token.address, callData: transferEncoded, value: ethers_1.BigNumber.from(0) };
}
exports.encodeTransfer = encodeTransfer;
function encodeTransferFrom(token, from, to, amount) {
    var transferFromEncoded = token.interface.encodeFunctionData('transferFrom', [from, to, amount]);
    return { target: token.address, callData: transferFromEncoded, value: ethers_1.BigNumber.from(0) };
}
exports.encodeTransferFrom = encodeTransferFrom;
function encodeApprove(token, to, amount) {
    var approveEncoded = token.interface.encodeFunctionData('approve', [to, amount]);
    return { target: token.address, callData: approveEncoded, value: ethers_1.BigNumber.from(0) };
}
exports.encodeApprove = encodeApprove;
function encodeWethDeposit(weth, amount) {
    var depositEncoded = weth.interface.encodeFunctionData('deposit', []);
    return { target: weth.address, callData: depositEncoded, value: amount };
}
exports.encodeWethDeposit = encodeWethDeposit;
function encodeEthTransfer(to, amount) {
    return { target: to, callData: '0x0', value: amount };
}
exports.encodeEthTransfer = encodeEthTransfer;
function encodePath(path, fees) {
    if (path.length != fees.length + 1) {
        throw new Error('path/fee lengths do not match');
    }
    var encoded = '0x';
    for (var i = 0; i < fees.length; i++) {
        // 20 byte encoding of the address
        encoded += path[i].slice(2);
        // 3 byte encoding of the fee
        encoded += fees[i].toString(16).padStart(2 * exports.FEE_SIZE, '0');
    }
    // encode the final token
    encoded += path[path.length - 1].slice(2);
    return encoded.toLowerCase();
}
exports.encodePath = encodePath;
