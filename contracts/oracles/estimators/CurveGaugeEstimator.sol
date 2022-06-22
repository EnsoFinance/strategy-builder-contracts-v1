//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../helpers/StrategyTypes.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/curve/ICurveGauge.sol";

contract CurveGaugeEstimator is IEstimator {
    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        return _estimateItem(balance, token, address(0)); 
    }

    function estimateItem(address user, address token) public view override returns (int256) { 
        uint256 balance = IERC20(token).balanceOf(address(user));
        address knownUnderlyingToken;
        StrategyTypes.TradeData memory td = IStrategy(user).getTradeData(token); 
        if (td.path.length != 0) knownUnderlyingToken = td.path[td.path.length - 1];
        return _estimateItem(balance, token, knownUnderlyingToken);
    }

    function _estimateItem(uint256 balance, address token, address knownUnderlyingToken) private view returns (int256) {
        address underlyingToken = ICurveGauge(token).lp_token();
        return IOracle(msg.sender).estimateItem(balance, underlyingToken, knownUnderlyingToken);
    }
}
