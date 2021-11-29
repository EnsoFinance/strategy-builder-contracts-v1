//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../BaseAdapter.sol";
import "../../interfaces/IRewardsAdapter.sol";
import "../../interfaces/curve/ICurveAddressProvider.sol";
import "../../interfaces/curve/ICurveGauge.sol";
import "../../interfaces/curve/ICurveRegistry.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract CurveRewardsAdapter is BaseAdapter, IRewardsAdapter {
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
    ) public override {
        require(tokenIn != tokenOut, "Tokens cannot match");
        ICurveRegistry curveRegistry = ICurveRegistry(addressProvider.get_registry());
        if (curveRegistry.get_pool_from_lp_token(tokenIn) != address(0)) { //Assume tokenOut is gauge contract
            ICurveGauge gauge = ICurveGauge(tokenOut);
            require(gauge.lp_token() == tokenIn, "Incompatible");
            if (from != address(this))
                IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            IERC20(tokenIn).safeApprove(tokenOut, amount);
            gauge.deposit(amount, address(this));
        } else { //Assume tokenIn is gauge contract
            ICurveGauge gauge = ICurveGauge(tokenIn);
            require(gauge.lp_token() == tokenOut, "Incompatible");
            if (from != address(this))
                IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            gauge.withdraw(amount);
        }
        uint256 received = IERC20(tokenOut).balanceOf(address(this));
        require(received >= expected, "Insufficient tokenOut amount");
        if (to != address(this))
            IERC20(tokenOut).safeTransfer(to, received);
    }

    // Intended to be called via delegateCall
    function claim(address token) public override {
        ICurveGauge gauge = ICurveGauge(token);
        gauge.claim_rewards(address(this));
    }
}
