//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "../interfaces/IStrategy.sol";

library StrategyLibrary {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    int256 private constant DIVISOR = 1000;

    function getExpectedTokenValue(
        uint256 total,
        address strategy,
        address token
    ) public view returns (int256) {
        int256 percentage = IStrategy(strategy).getPercentage(token);
        if (percentage == 0) return 0;
        return int256(total).mul(percentage).div(DIVISOR);
    }

    function getRange(int256 expectedValue, uint256 threshold) public pure returns (int256) {
        if (threshold == 0) return 0;
        return expectedValue.mul(int256(threshold)).div(DIVISOR);
    }

    /**
     * @notice This function gets the strategy value from the oracle and checks
     *         whether the strategy is balanced. Necessary to confirm the balance
     *         before and after a rebalance to ensure nothing fishy happened
     */
    function verifyBalance(address strategy, address oracle) public view returns (bool, uint256, int256[] memory) {
        (uint256 total, int256[] memory estimates) =
            IOracle(oracle).estimateStrategy(IStrategy(strategy));
        uint256 threshold = IStrategy(strategy).rebalanceThreshold();

        bool balanced = true;
        address[] memory strategyItems = IStrategy(strategy).items();
        for (uint256 i = 0; i < strategyItems.length; i++) {
            int256 expectedValue = getExpectedTokenValue(total, strategy, strategyItems[i]);
            if (expectedValue > 0) {
                int256 rebalanceRange = getRange(expectedValue, threshold);
                if (estimates[i] > expectedValue.add(rebalanceRange)) {
                    balanced = false;
                    break;
                }
                if (estimates[i] < expectedValue.sub(rebalanceRange)) {
                    balanced = false;
                    break;
                }
            } else {
                // Token has an expected value of 0, so any value can cause the contract
                // to be 'unbalanced' so we need an alternative way to determine balance.
                // Min percent = 0.1%. If token value is above, consider it unbalanced
                if (estimates[i] > getRange(int256(total), 1)) {
                    balanced = false;
                    break;
                }
            }
        }
        if (balanced) {
            address[] memory strategyDebt = IStrategy(strategy).debt();
            for (uint256 i = 0; i < strategyDebt.length; i++) {
              int256 expectedValue = getExpectedTokenValue(total, strategy, strategyDebt[i]);
              int256 rebalanceRange = getRange(expectedValue, threshold);
              uint256 index = strategyItems.length + i;
               // Debt
               if (estimates[index] < expectedValue.add(rebalanceRange)) {
                   balanced = false;
                   break;
               }
               if (estimates[index] > expectedValue.sub(rebalanceRange)) {
                   balanced = false;
                   break;
               }
            }
        }
        return (balanced, total, estimates);
    }

    /**
     * @notice This function gets the strategy value from the oracle and determines
     *         how out of balance the strategy using an absolute value.
     */
    function amountOutOfBalance(address strategy, uint256 total, int256[] memory estimates) public view returns (uint256) {
        if (total == 0) return 0;
        uint256 amount = 0;
        address[] memory strategyItems = IStrategy(strategy).items();
        for (uint256 i = 0; i < strategyItems.length; i++) {
            int256 expectedValue = getExpectedTokenValue(total, strategy, strategyItems[i]);
            if (estimates[i] > expectedValue) {
                amount = amount.add(uint256(estimates[i].sub(expectedValue)));
            } else if (estimates[i] < expectedValue) {
                amount = amount.add(uint256(expectedValue.sub(estimates[i])));
            }
        }
        address[] memory strategyDebt = IStrategy(strategy).debt();
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            int256 expectedValue = getExpectedTokenValue(total, strategy, strategyDebt[i]);
            uint256 index = strategyItems.length + i;
            if (estimates[index] > expectedValue) {
                amount = amount.add(uint256(estimates[index].sub(expectedValue)));
            } else if (estimates[index] < expectedValue) {
                amount = amount.add(uint256(expectedValue.sub(estimates[index])));
            }
        }
        return (amount.mul(10**18).div(total));
    }

    function checkBalance(address strategy, uint256 balanceBefore, uint256 total, int256[] memory estimates) public view {
        uint256 balanceAfter = amountOutOfBalance(strategy, total, estimates);
        if (balanceAfter > uint256(10**18).mul(IStrategy(strategy).rebalanceThreshold()).div(uint256(DIVISOR)))
            require(balanceAfter <= balanceBefore, "Lost balance");
    }
}
