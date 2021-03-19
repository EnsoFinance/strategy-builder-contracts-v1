//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../interfaces/IOracle.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IStrategyController.sol";
import "../libraries/StrategyLibrary.sol";

contract LibraryWrapper {
    IOracle public oracle;
    IStrategy public strategy;

    constructor(address oracle_, address strategy_) public {
        oracle = IOracle(oracle_);
        strategy = IStrategy(strategy_);
    }

    function isBalanced() external view returns (bool) {
        return
            StrategyLibrary.checkBalance(
                address(strategy),
                strategy.items(),
                IStrategyController(strategy.controller()).rebalanceThreshold(address(strategy))
            );
    }

    function isRebalanceNeeded(uint256 alertThreshold) external view returns (bool) {
        bool balanced =
            StrategyLibrary.checkBalance(address(strategy), strategy.items(), alertThreshold);
        return !balanced;
    }

    function getRange(uint256 total, uint256 range) external pure returns (uint256) {
        return StrategyLibrary.getRange(total, range);
    }

    function getRebalanceRange(uint256 total) external view returns (uint256) {
        uint256 range =
            IStrategyController(strategy.controller()).rebalanceThreshold(address(strategy));
        return StrategyLibrary.getRange(total, range);
    }

    function getStrategyValue() external view returns (uint256) {
        (uint256 total, ) = oracle.estimateTotal(address(strategy), strategy.items());
        return total;
    }

    function getTokenValue(address token) external view returns (uint256) {
        return StrategyLibrary.getTokenValue(address(strategy), token);
    }

    function getExpectedTokenValue(uint256 total, address token) external view returns (uint256) {
        return StrategyLibrary.getExpectedTokenValue(total, address(strategy), token);
    }
}
