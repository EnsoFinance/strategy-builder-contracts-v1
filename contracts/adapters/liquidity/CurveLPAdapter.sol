//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../libraries/SafeERC20.sol";
import "../../interfaces/curve/ICurveAddressProvider.sol";
import "../../interfaces/curve/ICurveDeposit.sol";
import "../../interfaces/curve/ICurveRegistry.sol";
import "../../interfaces/curve/ICurveStableSwap.sol";
import "../../interfaces/registries/ICurveDepositZapRegistry.sol";
import "../BaseAdapter.sol";

contract CurveLPAdapter is BaseAdapter {
    using SafeERC20 for IERC20;

    ICurveAddressProvider public immutable addressProvider;
    ICurveDepositZapRegistry public immutable zapRegistry;
    address public constant TRICRYPTO2 = 0xc4AD29ba4B3c580e6D59105FFf484999997675Ff;
    address public constant TRICRYPTO2_POOL = 0xD51a44d3FaE010294C616388b506AcdA1bfAAE46;
    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address private constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

    constructor(
        address addressProvider_,
        address zapRegistry_,
        address weth_
    ) public BaseAdapter(weth_) {
        addressProvider = ICurveAddressProvider(addressProvider_);
        zapRegistry = ICurveDepositZapRegistry(zapRegistry_);
    }

    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
        require(tokenIn != tokenOut, "Tokens cannot match");
        if (from != address(this))
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);

        ICurveRegistry curveRegistry = ICurveRegistry(addressProvider.get_registry());
        address poolIn = curveRegistry.get_pool_from_lp_token(tokenIn);
        address poolOut = curveRegistry.get_pool_from_lp_token(tokenOut);
        if (poolIn == address(0) && poolOut != address(0)) {
            _deposit(amount, tokenIn, poolOut, curveRegistry.get_coins(poolOut));
        } else if (poolIn != address(0) && poolOut == address(0)) {
            _withdraw(amount, tokenIn, tokenOut, poolIn, curveRegistry.get_coins(poolIn));
        } else if (poolIn != address(0) && poolOut != address(0)) { //Metapool
            bool isDeposit;
            address[8] memory depositCoins = curveRegistry.get_coins(poolOut);
            for (uint256 i = 0; i < 8; i++) {
                if (depositCoins[i] == address(0)) break;
                if (depositCoins[i] == tokenIn) {
                    isDeposit = true;
                    break;
                }
            }
            if (isDeposit) {
                _deposit(amount, tokenIn, poolOut, depositCoins);
            } else {
                bool isWithdraw;
                address[8] memory withdrawCoins = curveRegistry.get_coins(poolIn);
                for (uint256 i = 0; i < 8; i++) {
                    if (withdrawCoins[i] == address(0)) break;
                    if (withdrawCoins[i] == tokenOut) {
                        isWithdraw = true;
                        break;
                    }
                }
                if (isWithdraw) _withdraw(amount, tokenIn, tokenOut, poolIn, withdrawCoins);
            }
        } else if (tokenIn == TRICRYPTO2 || tokenOut == TRICRYPTO2) {
            // tricrypto not in registry
            address[8] memory coins;
            coins[0] = USDT;
            coins[1] = WBTC;
            coins[2] = WETH;
            if (tokenIn == TRICRYPTO2) _withdraw(amount, tokenIn, tokenOut, TRICRYPTO2_POOL, coins);
            if (tokenOut == TRICRYPTO2) _deposit(amount, tokenIn, TRICRYPTO2_POOL, coins);
        } else {
            revert();
        }
        uint256 received = IERC20(tokenOut).balanceOf(address(this));
        require(received >= expected, "Insufficient tokenOut amount");
        if (to != address(this))
            IERC20(tokenOut).safeTransfer(to, received);
    }

    function _deposit(
        uint256 amount,
        address tokenIn,
        address pool,
        address[8] memory coins
    ) internal {
        IERC20(tokenIn).safeApprove(pool, amount);
        uint256 coinsInPool;
        uint256 tokenIndex = 8; //Outside of possible index range. If index not found function will fail
        for (uint256 i = 0; i < 8; i++) {
          if (coins[i] == address(0)) {
              coinsInPool = i;
              break;
          }
          if (coins[i] == tokenIn) tokenIndex = i;
        }
        require(tokenIndex < 8, "Token not found");
        if (coinsInPool == 4) {
            uint256[4] memory depositAmounts;
            depositAmounts[tokenIndex] = amount;
            ICurveStableSwap(pool).add_liquidity(depositAmounts, 0);
        } else if (coinsInPool == 3) {
            uint256[3] memory depositAmounts;
            depositAmounts[tokenIndex] = amount;
            ICurveStableSwap(pool).add_liquidity(depositAmounts, 0);
        } else if (coinsInPool == 2) {
            uint256[2] memory depositAmounts;
            depositAmounts[tokenIndex] = amount;
            ICurveStableSwap(pool).add_liquidity(depositAmounts, 0);
        }
    }

    function _withdraw(
        uint256 amount,
        address tokenIn,
        address tokenOut,
        address pool,
        address[8] memory coins
    ) internal {
        address zap = zapRegistry.getZap(tokenIn);
        if (zap == address(0)) zap = pool;

        int128 tokenIndex;
        for (uint256 i = 0; i < 8; i++) {
            require(coins[i] != address(0), "Token not found in pool");
            if (coins[i] == tokenOut) {
                tokenIndex = int128(i);
                break;
            }
        }

        if (zap != pool)
            IERC20(tokenIn).safeApprove(zap, amount);

        uint256 indexType = zapRegistry.getIndexType(zap);
        if (indexType == 0) { //int128
            ICurveDeposit(zap).remove_liquidity_one_coin(amount, tokenIndex, 1);
        } else if (indexType == 1) { //uint256
            ICurveDeposit(zap).remove_liquidity_one_coin(amount, uint256(tokenIndex), 1);
        } else {
            return revert("Unknown index type");
        }
    }
}
