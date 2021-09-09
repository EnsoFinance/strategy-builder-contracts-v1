//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./ExchangeAdapter.sol";
import "../interfaces/IRewardsAdapter.sol";
import "../interfaces/curve/ICurveGauge.sol";
import "../interfaces/curve/ICurvePoolRegistry.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract CurveRewardsAdapter is ExchangeAdapter, IRewardsAdapter {
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
        (tokenIn, tokenOut);
        return amount; //LiquidityGauge tokens are issued at 1:1 ratio with their underlying
    }

    // @dev: Only works with LiquidityGaugeV2 and up since they implement ERC20
    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override returns (bool) {
        require(tokenIn != tokenOut, "Tokens cannot match");
        if (curveRegistry.gaugeContracts(tokenIn) != address(0)) {
            require(curveRegistry.gaugeContracts(tokenIn) == tokenOut, "Incompatible");
            if (from != address(this))
                IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            IERC20(tokenIn).safeApprove(tokenOut, amount);
            ICurveGauge(tokenOut).deposit(amount, address(this));
        } else {
            require(curveRegistry.gaugeContracts(tokenOut) == tokenIn, "Incompatible");
            if (from != address(this))
                IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            ICurveGauge(tokenIn).withdraw(amount);
        }
        uint256 received = IERC20(tokenOut).balanceOf(address(this));
        require(received >= expected, "Insufficient tokenOut amount");
        if (to != address(this))
            IERC20(tokenOut).safeTransfer(to, received);
        return true;
    }

    // Intended to be called via delegateCall
    function claim(address token) public override returns (bool) {
        ICurveGauge gauge = ICurveGauge(token);
        gauge.claim_rewards(address(this));
    }
}
