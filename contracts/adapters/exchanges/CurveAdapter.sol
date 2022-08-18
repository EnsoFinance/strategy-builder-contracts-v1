//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../libraries/SafeERC20.sol";
import "../../interfaces/curve/ICurveAddressProvider.sol";
import "../../interfaces/curve/ICurveStableSwap.sol";
import "../../interfaces/curve/ICurveRegistry.sol";
import "../BaseAdapter.sol";
import "../../helpers/StringUtils.sol";

contract CurveAdapter is BaseAdapter, StringUtils {
    using SafeERC20 for IERC20;

    ICurveAddressProvider public immutable addressProvider;

    constructor(
        address addressProvider_,
        address weth_
    ) public BaseAdapter(weth_) {
        addressProvider = ICurveAddressProvider(addressProvider_);
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
        ICurveRegistry curveRegistry = ICurveRegistry(addressProvider.get_registry());
        if (from != address(this)){
            uint256 beforeBalance = IERC20(tokenIn).balanceOf(address(this));
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            uint256 afterBalance = IERC20(tokenIn).balanceOf(address(this));
            require(afterBalance > beforeBalance, "No tokens transferred to adapter");
            amount = afterBalance - beforeBalance;
        }
        address pool = curveRegistry.find_pool_for_coins(tokenIn, tokenOut, 0);
        if (pool == address(0)) revert(string(abi.encodePacked("Pool not found ", toHexString(uint256(tokenIn), 20), " ", toHexString(uint256(tokenOut), 20))));
        (int128 indexIn, int128 indexOut, bool isUnderlying) = curveRegistry.get_coin_indices(pool, tokenIn, tokenOut);
        IERC20(tokenIn).sortaSafeApprove(pool, amount);
        if (isUnderlying) {
            ICurveStableSwap(pool).exchange_underlying(indexIn, indexOut, amount, 1);
        } else {
            ICurveStableSwap(pool).exchange(indexIn, indexOut, amount, 1);
        }
        require(IERC20(tokenIn).allowance(address(this), pool) == 0, "Incomplete swap"); // sanity check
        uint256 received = IERC20(tokenOut).balanceOf(address(this));
        require(received >= expected, "Insufficient tokenOut amount");
        if (to != address(this))
            IERC20(tokenOut).safeTransfer(to, received);
    }
}
