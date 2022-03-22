//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/curve/ICurveGauge.sol";

contract CurveGaugeEstimator is IEstimator {
    function estimateItem(uint256 balance, address token) public override returns (int256) {
        address underlyingToken = ICurveGauge(token).lp_token();
        return IOracle(msg.sender).estimateItem(balance, underlyingToken);
    }

    function estimateItem(address user, address token) public override returns (int256) { 
        revert("estimateItem: address parameter not supported.");
    }
}
