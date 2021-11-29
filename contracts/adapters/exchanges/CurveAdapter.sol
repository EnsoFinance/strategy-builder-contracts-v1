//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../BaseAdapter.sol";
import "../../interfaces/curve/ICurveAddressProvider.sol";
import "../../interfaces/curve/ICurveStableSwap.sol";
import "../../interfaces/curve/ICurveRegistry.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract CurveAdapter is BaseAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    ICurveAddressProvider public immutable addressProvider;

    constructor(
        address addressProvider_,
        address weth_
    ) public BaseAdapter(weth_) {
        addressProvider = ICurveAddressProvider(addressProvider_);
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        ICurveRegistry curveRegistry = ICurveRegistry(addressProvider.get_registry());
        address pool = curveRegistry.find_pool_for_coins(tokenIn, tokenOut, 0);
        if (pool != address(0)) {
            (int128 indexIn, int128 indexOut, ) = curveRegistry.get_coin_indices(pool, tokenIn, tokenOut);
            return  ICurveStableSwap(pool).get_dy(indexIn, indexOut, amount);
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
        ICurveRegistry curveRegistry = ICurveRegistry(addressProvider.get_registry());
        if (from != address(this))
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
        address pool = curveRegistry.find_pool_for_coins(tokenIn, tokenOut, 0);
        require(pool != address(0), "Pool not found");
        (int128 indexIn, int128 indexOut, ) = curveRegistry.get_coin_indices(pool, tokenIn, tokenOut);
        IERC20(tokenIn).safeApprove(pool, amount);
        ICurveStableSwap(pool).exchange(indexIn, indexOut, amount, 1);
        uint256 received = IERC20(tokenOut).balanceOf(address(this));
        require(received >= expected, "Insufficient tokenOut amount");
        if (to != address(this))
            IERC20(tokenOut).safeTransfer(to, received);
    }
}
