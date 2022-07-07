//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IStrategyRouter.sol";
import "../helpers/StrategyTypes.sol";
import "./SafeERC20.sol";

library StrategyLibrary {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;

    int256 private constant DIVISOR = 1000;

    int256 private constant PERCENTAGE_BOUND = 10000; // Max 10x leverage

    event Balanced(address indexed strategy, uint256 totalBefore, uint256 totalAfter);

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
        _useRouter(strategy, router, routerAction, weth, data);
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
        bytes memory data
    ) private {
        _useRouter(strategy, router, routerAction, weth, strategy.items(), strategy.debt(), data);
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


    function rebalance(
        IStrategy strategy,
        IStrategyRouter router,
        address oracle,
        address weth,
        uint256 rebalanceSlippage,
        bytes memory data
    ) external {
      // FIXME double check if this needs onlyController modifier
        _onlyApproved(address(router));
        _onlyManager(strategy);
        strategy.settleSynths();
        strategy.claimAll();
        (bool balancedBefore, uint256 totalBefore, int256[] memory estimates) = verifyBalance(address(strategy), oracle);
        require(!balancedBefore, "FIXME");//uint256(0x1bb63a90056c03) /* error_macro_for("Balanced") */);
        if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
            data = abi.encode(totalBefore, estimates);
        // Rebalance
        _useRouter(strategy, router, router.rebalance, weth, data);
        // Recheck total
        (bool balancedAfter, uint256 totalAfter, ) = verifyBalance(address(strategy), oracle);
        require(balancedAfter, "FIXME");//uint256(0x1bb63a90056c04) /* error_macro_for("Not balanced") */);
        _checkSlippage(totalAfter, totalBefore, rebalanceSlippage);
        IStrategyToken t = strategy.token();
        t.updateTokenValue(totalAfter, t.totalSupply());
        emit Balanced(address(strategy), totalBefore, totalAfter);
    }

    function repositionSynths(IStrategy strategy, address adapter, address token, address susd) external {
      // FIXME double check if this needs onlyController modifier
        _onlyManager(strategy);
        strategy.settleSynths();
        if (token == susd) {
            address[] memory synths = strategy.synths();
            for (uint256 i; i < synths.length; ++i) {
                uint256 amount = IERC20(synths[i]).balanceOf(address(strategy));
                if (amount > 0) {
                    strategy.delegateSwap(
                        adapter,
                        amount,
                        synths[i],
                        susd
                    );
                }
            }
        } else if (token == address(-1)) {
            uint256 susdBalance = IERC20(susd).balanceOf(address(strategy));
            int256 percentTotal = strategy.getPercentage(address(-1));
            address[] memory synths = strategy.synths();
            for (uint256 i; i < synths.length; ++i) {
                uint256 amount = uint256(int256(susdBalance).mul(strategy.getPercentage(synths[i])).div(percentTotal));
                if (amount > 0) {
                    strategy.delegateSwap(
                        adapter,
                        amount,
                        susd,
                        synths[i]
                    );
                }
            }
        } else {
            revert("Unsupported token");
        }
    }

    /**
     * @notice Checks that router is whitelisted
     */
    function _onlyApproved(address account) private view {
        require(IStrategyController(address(this)).whitelist().approved(account), "FIXME");//uint256(0x1bb63a90056c27) /* error_macro_for("Not approved") */);
    }

    /**
     * @notice Checks if msg.sender is manager
     */
    function _onlyManager(IStrategy strategy) private view {
        require(msg.sender == strategy.manager(), "FIXME");//uint256(0x1bb63a90056c28) /* error_macro_for("Not manager") */);
    }

    function _checkSlippage(uint256 slippedValue, uint256 referenceValue, uint256 slippage) private pure {
      require(
          slippedValue >= referenceValue.mul(slippage) / uint256(DIVISOR),
          "FIXME"//uint256(0x1bb63a90056c23) /* error_macro_for("Too much slippage") */
      );
    }

    /**
     * @notice Deposit eth or weth into strategy
     * @dev Calldata is only needed for the GenericRouter
     */
    function deposit(
        IStrategy strategy,
        IStrategyRouter router,
        address account,
        uint256 amount,
        uint256 slippage,
        uint256 totalBefore,
        uint256 balanceBefore,
        address weth,
        bytes memory data
    ) public {
      // FIXME double check if this needs onlyController modifier
        _onlyApproved(address(router));
        _checkDivisor(slippage);
        _approveSynthsAndDebt(strategy, strategy.debt(), address(router), uint256(-1));
        IOracle o = IStrategyController(address(this)).oracle();
        if (msg.value > 0) {
            require(amount == 0, "FIXME");//uint256(0x1bb63a90056c1b) /* error_macro_for("Ambiguous amount") */);
            amount = msg.value;
            IWETH(weth).deposit{value: amount}();
            IERC20(weth).safeApprove(address(router), amount);
            if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
                data = abi.encode(address(this), amount);
            router.deposit(address(strategy), data);
            IERC20(weth).safeApprove(address(router), 0);
        } else {
            if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
                data = abi.encode(account, amount);
            router.deposit(address(strategy), data);
        }
        _approveSynthsAndDebt(strategy, strategy.debt(), address(router), 0);
        // Recheck total
        (uint256 totalAfter, int256[] memory estimates) = o.estimateStrategy(strategy);
        require(totalAfter > totalBefore, "FIXME");//uint256(0x1bb63a90056c1c) /* error_macro_for("Lost value") */);
        checkBalance(address(strategy), balanceBefore, totalAfter, estimates);
        uint256 valueAdded = totalAfter - totalBefore; // Safe math not needed, already checking for underflow
        _checkSlippage(valueAdded, amount, slippage);
        IStrategyToken t = strategy.token();
        uint256 totalSupply = t.totalSupply();
        uint256 relativeTokens =
            totalSupply > 0 ? totalSupply.mul(valueAdded).div(totalBefore) : totalAfter;
        require(relativeTokens > 0, "Insuffient tokens");
        t.updateTokenValue(totalAfter, totalSupply.add(relativeTokens));
        t.mint(account, relativeTokens);
        // FIXME put event here emit Deposit
    }

    function verifyStructure(address strategy, StrategyTypes.StrategyItem[] memory newItems)
        public
        view
        returns (bool)
    {
        require(newItems.length > 0, "FIXME");//uint256(0x1bb63a90056c10) /* error_macro_for("Cannot set empty structure") */);
        require(newItems[0].item != address(0), "FIXME");//uint256(0x1bb63a90056c11) /* error_macro_for("Invalid item addr") */); //Everything else will be caught by the ordering _requirement below
        require(newItems[newItems.length-1].item != address(-1), "FIXME");//uint256(0x1bb63a90056c12) /* error_macro_for("Invalid item addr") */); //Reserved space for virtual item

        ITokenRegistry registry = IStrategyController(address(this)).oracle().tokenRegistry();

        bool supportsSynths;
        bool supportsDebt;

        int256 total;
        address item;
        for (uint256 i; i < newItems.length; ++i) {
            item = newItems[i].item;
            require(i == 0 || newItems[i].item > newItems[i - 1].item, "FIXME");//uint256(0x1bb63a90056c13) /* error_macro_for("Item ordering") */);
            int256 percentage = newItems[i].percentage;
            uint256 itemCategory = registry.itemCategories(item);
            if (itemCategory == uint256(StrategyTypes.ItemCategory.DEBT)) {
              supportsDebt = true;
              require(percentage <= 0, "FIXME");//uint256(0x1bb63a90056c14) /* error_macro_for("Debt cannot be positive") */);
              require(percentage >= -PERCENTAGE_BOUND, "FIXME");//uint256(0x1bb63a90056c15) /* error_macro_for("Out of bounds") */);
            } else {
              if (itemCategory == uint256(StrategyTypes.ItemCategory.SYNTH))
                  supportsSynths = true;
              require(percentage >= 0, "FIXME");//uint256(0x1bb63a90056c16) /* error_macro_for("Token cannot be negative") */);
              require(percentage <= PERCENTAGE_BOUND, "FIXME");//uint256(0x1bb63a90056c17) /* error_macro_for("Out of bounds") */);
            }
            uint256 estimatorCategory = registry.estimatorCategories(item);
            require(estimatorCategory != uint256(StrategyTypes.EstimatorCategory.BLOCKED), "FIXME");//uint256(0x1bb63a90056c18) /* error_macro_for("Token blocked") */);
            if (estimatorCategory == uint256(StrategyTypes.EstimatorCategory.STRATEGY))
                _checkCyclicDependency(strategy, IStrategy(item), registry);
            total = total.add(percentage);
        }
        require(!(supportsSynths && supportsDebt), "FIXME");//uint256(0x1bb63a90056c19) /* error_macro_for("No synths and debt") */);
        require(total == int256(DIVISOR), "FIXME");//uint256(0x1bb63a90056c1a) /* error_macro_for("Total percentage wrong") */);
        return true;
    }

    function _checkCyclicDependency(address test, IStrategy strategy, ITokenRegistry registry) private view {
        require(address(strategy) != test, "FIXME");//uint256(0x1bb63a90056c21) /* error_macro_for("Cyclic dependency") */);
        require(!strategy.supportsSynths(), "FIXME");//uint256(0x1bb63a90056c22) /* error_macro_for("Synths not supported") */);
        address[] memory strategyItems = strategy.items();
        for (uint256 i; i < strategyItems.length; ++i) {
          if (registry.estimatorCategories(strategyItems[i]) == uint256(StrategyTypes.EstimatorCategory.STRATEGY))
              _checkCyclicDependency(test, IStrategy(strategyItems[i]), registry);
        }
    }

    function _checkDivisor(uint256 value) private pure {
        require(value <= uint256(DIVISOR), "FIXME");//uint256(0x1bb63a90056c24) /* error_macro_for("Out of bounds") */);
    }
}
