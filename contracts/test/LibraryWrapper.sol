//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IOracle.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IStrategyController.sol";
import "../libraries/ControllerLibrary.sol";
import "../libraries/StrategyLibrary.sol";
import "../helpers/StrategyTypes.sol";

contract LibraryWrapper is StrategyTypes{
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    IOracle public oracle;
    IStrategy public strategy;
    IStrategyController public controller;

    constructor(address oracle_, address strategy_, address controller_) public {
        oracle = IOracle(oracle_);
        strategy = IStrategy(strategy_);
        controller = IStrategyController(controller_);
    }

    function isBalanced() external view returns (bool balanced) {
        (balanced,,) = ControllerLibrary.verifyBalance(strategy, oracle, controller.rebalanceThresholdScalar());
        return balanced;
    }

    function isBalancedInner() external view returns (bool balanced) {
        (balanced,,) = ControllerLibrary.verifyBalance(strategy, oracle, 0);
        return balanced;
    }

    function getRange(int256 expectedValue, uint256 range) external pure returns (int256) {
        return StrategyLibrary.getRange(expectedValue, range);
    }

    function getRebalanceRange(int256 expectedValue) external view returns (int256) {
        uint256 range = strategy.rebalanceThreshold();
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
            address[] memory synths = s.synths();
            int256 estimate = 0;
            for (uint256 i = 0; i < synths.length; i++) {
              estimate = estimate.add(oracle.estimateItem(
                IERC20(synths[i]).balanceOf(address(s)),
                synths[i]
              ));
            }
            estimate = estimate.add(oracle.estimateItem(
              IERC20(oracle.susd()).balanceOf(address(s)),
              oracle.susd()
            ));
            return estimate;
        } else if (token == oracle.weth()) {
            return int256(IERC20(token).balanceOf(address(s)));
        } else {
            return oracle.estimateItem(
                IERC20(token).balanceOf(address(s)),
                token
            );
        }
    }
}
