//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IStrategyRouter.sol";

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
    function verifyBalance(address strategy, address oracle) external view returns (bool, uint256, int256[] memory) {
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

    /**
     * @notice Wrap router function with approve and unapprove
     * @param strategy The strategy contract
     * @param router The router that will be used
     * @param routerAction The function pointer action that the router will perform
     * @param data The data that will be sent to the router
     */
    function useRouter(
        IStrategy strategy,
        IStrategyRouter router,
        function(address, bytes memory) external routerAction,
        address weth,
        bytes memory data
    ) public {
      // FIXME double check if this needs onlyController modifier
        _useRouter(strategy, router, routerAction, weth, strategy.items(), strategy.debt(), data);
    }

    /**
     * @notice Wrap router function with approve and unapprove
     * @param strategy The strategy contract
     * @param router The router that will be used
     * @param routerAction The function pointer action that the router will perform
     * @param strategyItems An array of tokens
     * @param strategyDebt An array of debt tokens
     * @param data The data that will be sent to the router
     */
    function useRouter(
        IStrategy strategy,
        IStrategyRouter router,
        function(address, bytes memory) external routerAction,
        address weth,
        address[] memory strategyItems,
        address[] memory strategyDebt,
        bytes memory data
    ) public {
      // FIXME double check if this needs onlyController modifier
        _useRouter(strategy, router, routerAction, weth, strategyItems, strategyDebt, data);
    }

    function _useRouter(
        IStrategy strategy,
        IStrategyRouter router,
        function(address, bytes memory) external routerAction,
        address weth,
        address[] memory strategyItems,
        address[] memory strategyDebt,
        bytes memory data
    ) private {
        _approveItems(strategy, weth, strategyItems, strategyDebt, address(router), uint256(-1));
        routerAction(address(strategy), data);
        _approveItems(strategy, weth, strategyItems, strategyDebt, address(router), uint256(0));
    }

    /**
     * @notice Batch approve items
     * @param strategy The strategy contract
     * @param strategyItems An array of tokens
     * @param strategyDebt An array of debt tokens
     * @param router The router that will be approved to spend tokens
     * @param amount The amount the each token will be approved for
     */
    function _approveItems(
        IStrategy strategy,
        address weth,
        address[] memory strategyItems,
        address[] memory strategyDebt,
        address router,
        uint256 amount
    ) private {
        strategy.approveToken(weth, router, amount);
        if (strategyItems.length > 0) strategy.approveTokens(strategyItems, router, amount);
        _approveSynthsAndDebt(strategy, strategyDebt, router, amount);
    }

    /**
     * @notice Batch approve synths and debt
     * @param strategy The strategy contract
     * @param strategyDebt An array of debt tokens
     * @param router The router that will be approved to spend tokens
     * @param amount The amount the each token will be approved for
     */
    function approveSynthsAndDebt(
        IStrategy strategy,
        address[] memory strategyDebt,
        address router,
        uint256 amount
    ) public {
      // FIXME double check if this needs onlyController modifier
        if (strategyDebt.length > 0) strategy.approveDebt(strategyDebt, router, amount);
        if (strategy.supportsDebt()) {
            if (amount == 0) {
                strategy.setRouter(address(0));
            } else {
                strategy.setRouter(router);
            }
        }
        if (strategy.supportsSynths()) strategy.approveSynths(router, amount);
    }

    function _approveSynthsAndDebt(
        IStrategy strategy,
        address[] memory strategyDebt,
        address router,
        uint256 amount
    ) private {
        if (strategyDebt.length > 0) strategy.approveDebt(strategyDebt, router, amount);
        if (strategy.supportsDebt()) {
            if (amount == 0) {
                strategy.setRouter(address(0));
            } else {
                strategy.setRouter(router);
            }
        }
        if (strategy.supportsSynths()) strategy.approveSynths(router, amount);
    }
}
