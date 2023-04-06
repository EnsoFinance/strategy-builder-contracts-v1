//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../helpers/StrategyTypes.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/curve/ICurveGauge.sol";

contract CurveGaugeEstimator is IEstimator {
    function estimateItem(
        IStrategy strategy,
        address token
    ) public view override returns (int256) {
        uint256 balance = IERC20(token).balanceOf(address(strategy));
        return estimateItem(strategy, token, balance);
    }

    function estimateItem(
        IStrategy strategy,
        address token,
        uint256 balance
    ) public view override returns (int256) {
        address lpToken = ICurveGauge(token).lp_token();
        address knownUnderlyingToken;
        if (address(strategy) != address(0)) {
            StrategyTypes.TradeData memory td = strategy.getTradeData(token);
            if (td.path.length != 0) knownUnderlyingToken = td.path[td.path.length - 2];
        }
        return IOracle(msg.sender).estimateItem(strategy, lpToken, knownUnderlyingToken, balance);
    }
}
