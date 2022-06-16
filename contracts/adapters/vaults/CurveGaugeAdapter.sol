//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../libraries/SafeERC20.sol";
import "../../interfaces/IRewardsAdapter.sol";
import "../../interfaces/curve/ICurveGauge.sol";
import "../ProtocolAdapter.sol";

contract CurveGaugeAdapter is ProtocolAdapter, IRewardsAdapter {
    using SafeERC20 for IERC20;

    constructor(
      address weth_,
      address tokenRegistry_,
      uint256 categoryIndex_
    ) public ProtocolAdapter(weth_, tokenRegistry_, categoryIndex_) {}

    // @dev: Only works with LiquidityGaugeV2 and up since they implement ERC20
    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
        require(tokenIn != tokenOut, "Tokens cannot match");
        if (_checkToken(tokenOut)) {
            ICurveGauge gauge = ICurveGauge(tokenOut);
            require(gauge.lp_token() == tokenIn, "Incompatible");
            amount = _takeTokens(from, tokenIn, amount);
            IERC20(tokenIn).safeApprove(tokenOut, amount);
            gauge.deposit(amount, address(this));
        } else {
            require(_checkToken(tokenIn), "No Curve Gauge token");
            ICurveGauge gauge = ICurveGauge(tokenIn);
            require(gauge.lp_token() == tokenOut, "Incompatible");
            amount = _takeTokens(from, tokenIn, amount);
            gauge.withdraw(amount);
        }
        uint256 received = IERC20(tokenOut).balanceOf(address(this));
        require(received >= expected, "Insufficient tokenOut amount");
        if (to != address(this)) IERC20(tokenOut).safeTransfer(to, received);
    }

    function _takeTokens(address from, address tokenIn, uint256 amount) internal returns (uint256) {
        if (from != address(this)) {
            uint256 beforeBalance = IERC20(tokenIn).balanceOf(address(this));
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            uint256 afterBalance = IERC20(tokenIn).balanceOf(address(this));
            require(afterBalance > beforeBalance, "No tokens transferred to adapter");
            return afterBalance - beforeBalance;
        } else {
            return amount;
        }
    }

     // Intended to be called via delegateCall
    function claim(address[] memory tokens) external override {
        for (uint256 i; i < tokens.length; ++i) {
          ICurveGauge(tokens[i]).claim_rewards(address(this));
        }
    }

    // Intended to be called via delegateCall
    /*function claim(address token) external override {
        require(_checkToken(token), "Not claimable");
        ICurveGauge gauge = ICurveGauge(token);
        gauge.claim_rewards(address(this));
    }*/
}
