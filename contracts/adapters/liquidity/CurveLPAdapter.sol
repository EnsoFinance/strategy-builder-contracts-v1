//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/SafeERC20.sol";
import "../../interfaces/curve/ICurveAddressProvider.sol";
import "../../interfaces/curve/ICurveDeposit.sol";
import "../../interfaces/curve/ICurveRegistry.sol";
import "../../interfaces/curve/ICurveStableSwap.sol";
import "../../interfaces/registries/ICurveDepositZapRegistry.sol";
import "../BaseAdapter.sol";

contract CurveLPAdapter is BaseAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    ICurveAddressProvider public immutable addressProvider;
    ICurveDepositZapRegistry public immutable zapRegistry;

    constructor(
        address addressProvider_,
        address zapRegistry_,
        address weth_
    ) public BaseAdapter(weth_) {
        addressProvider = ICurveAddressProvider(addressProvider_);
        zapRegistry = ICurveDepositZapRegistry(zapRegistry_);
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        ICurveRegistry curveRegistry = ICurveRegistry(addressProvider.get_registry());
        address poolIn = curveRegistry.get_pool_from_lp_token(tokenIn);
        address poolOut = curveRegistry.get_pool_from_lp_token(tokenOut);
        if (poolIn == address(0) && poolOut != address(0)) {
            return _depositPrice(amount, tokenIn, poolOut, curveRegistry.get_coins(poolOut));
        } else if (poolIn != address(0) && poolOut == address(0)) {
            return _withdrawPrice(amount, tokenIn, tokenOut, poolIn, curveRegistry.get_coins(poolIn));
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
                return _depositPrice(amount, tokenIn, poolOut, depositCoins);
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
                if (isWithdraw) return _withdrawPrice(amount, tokenIn, tokenOut, poolIn, withdrawCoins);
            }
        } else {
            return 0;
        }
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
        IERC20(tokenIn).approve(zap, amount);
        ICurveDeposit(zap).remove_liquidity_one_coin(amount, tokenIndex, 1);
    }

    function _depositPrice(
        uint256 amount,
        address tokenIn,
        address pool,
        address[8] memory coins
    ) internal view returns (uint256) {
        uint256 coinsInPool;
        uint256 tokenIndex = 8; // Outside of possible index range. If index not found function will return 0
        for (uint256 i = 0; i < 8; i++) {
          if (coins[i] == address(0)) {
              coinsInPool = i;
              break;
          }
          if (coins[i] == tokenIn) tokenIndex = i;
        }
        if (tokenIndex == 8) return 0; // Token not found
        if (coinsInPool == 4) {
            uint256[4] memory depositAmounts;
            depositAmounts[tokenIndex] = amount;
            return ICurveStableSwap(pool).calc_token_amount(depositAmounts, true);
        } else if (coinsInPool == 3) {
            uint256[3] memory depositAmounts;
            depositAmounts[tokenIndex] = amount;
            return ICurveStableSwap(pool).calc_token_amount(depositAmounts, true);
        } else if (coinsInPool == 2) {
            uint256[2] memory depositAmounts;
            depositAmounts[tokenIndex] = amount;
            return ICurveStableSwap(pool).calc_token_amount(depositAmounts, true);
        }
    }

    function _withdrawPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut,
        address pool,
        address[8] memory coins
    ) internal view returns (uint256) {
        address zap = zapRegistry.getZap(tokenIn);
        if (zap == address(0)) zap = pool;

        int128 tokenIndex;
        for (uint256 i = 0; i < coins.length; i++) {
          if (coins[i] == address(0)) return 0; // tokenOut is not in list
          if (coins[i] == tokenOut) {
              tokenIndex = int128(i);
              break;
          }
        }
        return ICurveDeposit(zap).calc_withdraw_one_coin(amount, tokenIndex);
    }
}
