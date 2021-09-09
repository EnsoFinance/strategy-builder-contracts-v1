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
exports.encodePath = exports.encodeEthTransfer = exports.encodeWethWithdraw = exports.encodeWethDeposit = exports.encodeApprove = exports.encodeTransferFrom = exports.encodeTransfer = exports.encodeSettleTransferFrom = exports.encodeSettleTransfer = exports.encodeSettleSwap = exports.encodeUniswapPairSwap = exports.encodeDelegateSwap = exports.encodeSwap = exports.encodeStrategyItem = exports.getRebalanceRange = exports.getExpectedTokenValue = exports.calculateAddress = exports.preparePermit = exports.prepareDepositMulticall = exports.prepareRebalanceMulticall = exports.prepareUniswapSwap = exports.prepareStrategy = exports.FEE_SIZE = void 0;
var ethers_1 = require("ethers");
var utils_1 = require("./utils");
var ERC20_json_1 = __importDefault(require("@uniswap/v2-periphery/build/ERC20.json"));
var UniswapV2Pair_json_1 = __importDefault(require("@uniswap/v2-core/build/UniswapV2Pair.json"));
var hre = require('hardhat');
var ethers = hre.ethers;
var constants = ethers.constants, getContractFactory = ethers.getContractFactory;
var AddressZero = constants.AddressZero;
exports.FEE_SIZE = 3;
function prepareStrategy(positions, defaultAdapter) {
    var items = [];
    positions
        .sort(function (a, b) {
        var aNum = ethers_1.BigNumber.from(a.token);
        var bNum = ethers_1.BigNumber.from(b.token);
        return aNum.gt(bNum) ? 1 : -1;
    })
        .forEach(function (position) {
        if (!position.adapters)
            position.adapters = [defaultAdapter];
        if (!position.path)
            position.path = []; // path.length is always 1 less than adapter.length
        var item = encodeStrategyItem(position);
        items.push(item);
    });
    return items;
}
exports.prepareStrategy = prepareStrategy;
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
                    return [4 /*yield*/, adapter.spotPrice(amount, tokenIn.address, tokenOut.address)];
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
        var calls, buyLoop, tokens, _a, total, estimates, slippage, wethInStrategy, i, token, estimatedValue, expectedValue, _b, _c, diff, expected, i, token, estimatedValue, expectedValue, _d, _e, diff, expected, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    calls = [];
                    buyLoop = [];
                    return [4 /*yield*/, strategy.items()];
                case 1:
                    tokens = _h.sent();
                    return [4 /*yield*/, oracle.estimateStrategy(strategy.address)];
                case 2:
                    _a = _h.sent(), total = _a[0], estimates = _a[1];
                    return [4 /*yield*/, controller.slippage(strategy.address)];
                case 3:
                    slippage = _h.sent();
                    wethInStrategy = false;
                    i = 0;
                    _h.label = 4;
                case 4:
                    if (!(i < tokens.length)) return [3 /*break*/, 12];
                    return [4 /*yield*/, ethers.getContractAt(ERC20_json_1.default.abi, tokens[i])];
                case 5:
                    token = _h.sent();
                    estimatedValue = ethers.BigNumber.from(estimates[i]);
                    _c = (_b = ethers.BigNumber).from;
                    return [4 /*yield*/, getExpectedTokenValue(total, token.address, strategy)];
                case 6:
                    expectedValue = _c.apply(_b, [_h.sent()]);
                    if (!(token.address.toLowerCase() != weth.address.toLowerCase())) return [3 /*break*/, 10];
                    if (!estimatedValue.gt(expectedValue)) return [3 /*break*/, 8];
                    return [4 /*yield*/, adapter.spotPrice(estimatedValue.sub(expectedValue), weth.address, token.address)];
                case 7:
                    diff = _h.sent();
                    expected = estimatedValue.sub(expectedValue).mul(slippage).div(utils_1.DIVISOR);
                    calls.push(encodeDelegateSwap(router, adapter.address, diff, expected, token.address, weth.address, strategy.address, strategy.address));
                    return [3 /*break*/, 9];
                case 8:
                    buyLoop.push({
                        token: tokens[i],
                        estimate: estimates[i],
                    });
                    _h.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (expectedValue.gt(0))
                        wethInStrategy = true;
                    _h.label = 11;
                case 11:
                    i++;
                    return [3 /*break*/, 4];
                case 12:
                    i = 0;
                    _h.label = 13;
                case 13:
                    if (!(i < buyLoop.length)) return [3 /*break*/, 19];
                    return [4 /*yield*/, ethers.getContractAt(ERC20_json_1.default.abi, buyLoop[i].token)];
                case 14:
                    token = _h.sent();
                    estimatedValue = ethers.BigNumber.from(buyLoop[i].estimate);
                    if (!(token.address.toLowerCase() != weth.address.toLowerCase())) return [3 /*break*/, 18];
                    if (!(!wethInStrategy && i == buyLoop.length - 1)) return [3 /*break*/, 15];
                    //console.log('Buy token:  ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString())
                    // The last token must use up the remainder of funds, but since balance is unknown, we call this function which does the final cleanup
                    calls.push(encodeSettleSwap(router, adapter.address, weth.address, token.address, strategy.address, strategy.address));
                    return [3 /*break*/, 18];
                case 15:
                    _e = (_d = ethers.BigNumber).from;
                    return [4 /*yield*/, getExpectedTokenValue(total, token.address, strategy)];
                case 16:
                    expectedValue = _e.apply(_d, [_h.sent()]);
                    if (!estimatedValue.lt(expectedValue)) return [3 /*break*/, 18];
                    diff = expectedValue.sub(estimatedValue);
                    _g = (_f = ethers_1.BigNumber).from;
                    return [4 /*yield*/, adapter.spotPrice(diff, weth.address, token.address)];
                case 17:
                    expected = _g.apply(_f, [_h.sent()]).mul(slippage).div(utils_1.DIVISOR);
                    calls.push(encodeDelegateSwap(router, adapter.address, diff, expected, weth.address, token.address, strategy.address, strategy.address));
                    _h.label = 18;
                case 18:
                    i++;
                    return [3 /*break*/, 13];
                case 19: return [2 /*return*/, calls];
            }
        });
    });
}
exports.prepareRebalanceMulticall = prepareRebalanceMulticall;
function prepareDepositMulticall(strategy, controller, router, adapter, weth, total, strategyItems) {
    return __awaiter(this, void 0, void 0, function () {
        var calls, slippage, wethInStrategy, i, category, token, percentage, amount, expected, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    calls = [];
                    return [4 /*yield*/, controller.slippage(strategy.address)];
                case 1:
                    slippage = _c.sent();
                    wethInStrategy = false;
                    i = 0;
                    _c.label = 2;
                case 2:
                    if (!(i < strategyItems.length)) return [3 /*break*/, 10];
                    category = ethers.BigNumber.from(1);
                    if (!category.eq(1)) return [3 /*break*/, 8];
                    return [4 /*yield*/, ethers.getContractAt(ERC20_json_1.default.abi, strategyItems[i].item)];
                case 3:
                    token = _c.sent();
                    percentage = strategyItems[i].percentage;
                    if (!(token.address.toLowerCase() !== weth.address.toLowerCase())) return [3 /*break*/, 7];
                    if (!(!wethInStrategy && i == strategyItems.length - 1)) return [3 /*break*/, 4];
                    calls.push(encodeSettleSwap(router, adapter.address, weth.address, token.address, strategy.address, strategy.address));
                    return [3 /*break*/, 6];
                case 4:
                    amount = ethers_1.BigNumber.from(total).mul(percentage).div(utils_1.DIVISOR);
                    _b = (_a = ethers_1.BigNumber).from;
                    return [4 /*yield*/, adapter.spotPrice(amount, weth.address, token.address)];
                case 5:
                    expected = _b.apply(_a, [_c.sent()]).mul(slippage).div(utils_1.DIVISOR);
                    //console.log('Buy token: ', i, ' estimated value: ', 0, ' expected value: ', amount.toString())
                    calls.push(encodeDelegateSwap(router, adapter.address, amount, expected, weth.address, token.address, strategy.address, strategy.address));
                    _c.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    if (percentage.gt(0))
                        wethInStrategy = true;
                    _c.label = 8;
                case 8:
                    if (category.eq(2)) { //STRATEGY
                        // TODO: Lookup strategy items + item data, then call prepareDepositMulticall
                    }
                    _c.label = 9;
                case 9:
                    i++;
                    return [3 /*break*/, 2];
                case 10: 
                /*
                if (wethInStrategy) {
                    calls.push(encodeSettleTransferFrom(router, weth.address, controller.address, strategy.address))
                }
                */
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
                    return [4 /*yield*/, ethers.provider.send('eth_signTypedData_v4', [owner.address, typedData])];
                case 2: return [2 /*return*/, _c.apply(_b, [_d.sent()])];
            }
        });
    });
}
exports.preparePermit = preparePermit;
function calculateAddress(strategyFactory, creator, name, symbol) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, salt, implementation, admin, Proxy, deployTx;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        strategyFactory.salt(creator, name, symbol),
                        strategyFactory.implementation(),
                        strategyFactory.admin()
                    ])];
                case 1:
                    _a = _b.sent(), salt = _a[0], implementation = _a[1], admin = _a[2];
                    return [4 /*yield*/, getContractFactory('TransparentUpgradeableProxy')];
                case 2:
                    Proxy = _b.sent();
                    deployTx = Proxy.getDeployTransaction(implementation, admin, '0x');
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
                case 0: return [4 /*yield*/, strategy.getPercentage(token)];
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
function encodeStrategyItem(position) {
    var data = {
        adapters: position.adapters || [],
        path: position.path || [],
        cache: position.cache || '0x',
    };
    var item = {
        item: position.token,
        percentage: position.percentage || ethers_1.BigNumber.from(0),
        data: data
    };
    return item;
}
exports.encodeStrategyItem = encodeStrategyItem;
function encodeSwap(adapter, amountTokens, minTokens, tokenIn, tokenOut, accountFrom, accountTo) {
    var swapEncoded = adapter.interface.encodeFunctionData('swap', [
        amountTokens,
        minTokens,
        tokenIn,
        tokenOut,
        accountFrom,
        accountTo
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
        accountTo
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
        accountTo
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
function encodeWethWithdraw(weth, amount) {
    var withdrawEncoded = weth.interface.encodeFunctionData('withdraw', [amount]);
    return { target: weth.address, callData: withdrawEncoded, value: ethers_1.BigNumber.from(0) };
}
exports.encodeWethWithdraw = encodeWethWithdraw;
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
