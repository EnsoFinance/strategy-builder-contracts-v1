//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IOracle.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IStrategyController.sol";
import "../libraries/StrategyLibrary.sol";
import "../helpers/StrategyTypes.sol";

contract LibraryWrapper is StrategyTypes{
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    IOracle public oracle;
    IStrategy public strategy;

    constructor(address oracle_, address strategy_) public {
        oracle = IOracle(oracle_);
        strategy = IStrategy(strategy_);
    }

    function isBalanced() external view returns (bool) {
        return
            _checkBalance(
                IStrategyController(strategy.controller()).rebalanceThreshold(address(strategy))
            );
    }

    function isRebalanceNeeded(uint256 alertThreshold) external view returns (bool) {
        bool balanced = _checkBalance(alertThreshold);
        return !balanced;
    }

    function getRange(int256 expectedValue, uint256 range) external pure returns (int256) {
        return StrategyLibrary.getRange(expectedValue, range);
    }

    function getRebalanceRange(int256 expectedValue) external view returns (int256) {
        uint256 range =
            IStrategyController(strategy.controller()).rebalanceThreshold(address(strategy));
        return StrategyLibrary.getRange(expectedValue, range);
    }

    function getStrategyValue() external view returns (uint256) {
        (uint256 total, ) = oracle.estimateStrategy(strategy);
        return total;
    }

    function getTokenValue(address token) external view returns (int256) {
        return _getTokenValue(strategy, token);
    }

    function getExpectedTokenValue(uint256 total, address token) external view returns (int256) {
        return StrategyLibrary.getExpectedTokenValue(total, address(strategy), token);
    }

    function _getTokenValue(IStrategy s, address token) internal view returns (int256) {
        if (token == address(0)) {
            return int256(address(s).balance);
        } else if (token == address(-1)) {
            (uint256 estimate, ) = s.oracle().chainlinkOracle().estimateTotal(address(s), s.synths());
            return int256(estimate);
        } else if (token == oracle.weth()) {
            return int256(IERC20(token).balanceOf(address(s)));
        } else {
            return s.oracle().estimateItem(
                IERC20(token).balanceOf(address(s)),
                token
            );
        }
    }

    function _checkBalance(
        uint256 threshold
    ) internal view returns (bool) {
        (uint256 total, int256[] memory estimates) =
            oracle.estimateStrategy(strategy);
        bool balanced = true;
        address[] memory strategyItems = strategy.items();
        for (uint256 i = 0; i < strategyItems.length; i++) {
            address tokenAddress = strategyItems[i];
            int256 expectedValue = StrategyLibrary.getExpectedTokenValue(total, address(strategy), tokenAddress);
            int256 rebalanceRange = StrategyLibrary.getRange(expectedValue, threshold);
            if (estimates[i] < 0) {
              if (estimates[i] < expectedValue.add(rebalanceRange)) {
                  balanced = false;
                  break;
              }
              if (estimates[i] > expectedValue.sub(rebalanceRange)) {
                  balanced = false;
                  break;
              }
            } else {
              if (estimates[i] > expectedValue.add(rebalanceRange)) {
                  balanced = false;
                  break;
              }
              if (estimates[i] < expectedValue.sub(rebalanceRange)) {
                  balanced = false;
                  break;
              }
            }
        }
        return balanced;
    }
}
