//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./ExchangeAdapter.sol";
import "../interfaces/curve/ICurveStableSwap.sol";
import "../interfaces/curve/ICurvePoolRegistry.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract CurveAdapter is ExchangeAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    ICurvePoolRegistry public immutable curveRegistry;

    constructor(
        address curveRegistry_,
        address weth_
    ) public ExchangeAdapter(weth_) {
        curveRegistry = ICurvePoolRegistry(curveRegistry_);
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        address poolToken = curveRegistry.exchanges(tokenIn, tokenOut);
        if (poolToken != address(0)) {
            ICurveStableSwap swapContract = ICurveStableSwap(curveRegistry.swapContracts(poolToken));
            uint256 indexIn = curveRegistry.coinIndexes(poolToken, tokenIn);
            uint256 indexOut = curveRegistry.coinIndexes(poolToken, tokenOut);
            return swapContract.get_dy(int128(indexIn), int128(indexOut), amount);
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
    ) public override returns (bool) {
        require(tokenIn != tokenOut, "Tokens cannot match");
        if (from != address(this))
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
        address poolToken = curveRegistry.exchanges(tokenIn, tokenOut);
        require(poolToken != address(0), "Pool not found");
        ICurveStableSwap swapContract = ICurveStableSwap(curveRegistry.swapContracts(poolToken));
        uint256 indexIn = curveRegistry.coinIndexes(poolToken, tokenIn);
        uint256 indexOut = curveRegistry.coinIndexes(poolToken, tokenOut);
        IERC20(tokenIn).safeApprove(address(swapContract), amount);
        swapContract.exchange(int128(indexIn), int128(indexOut), amount, 1);
        uint256 received = IERC20(tokenOut).balanceOf(address(this));
        require(received >= expected, "Insufficient tokenOut amount");
        if (to != address(this))
            IERC20(tokenOut).safeTransfer(to, received);
        return true;
    }
}
