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
import "./AddressArrays.sol";
import "./StrategyLibrary.sol";

library ControllerLibrary {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;
    using AddressArrays for address[];

    int256 private constant DIVISOR = 1000;

    uint256 private constant PRECISION = 10**18;
    uint256 private constant WITHDRAW_UPPER_BOUND = 10**17; // Upper condition for including pool's tokens as part of burn during withdraw
    uint256 private constant WITHDRAW_LOWER_BOUND = 10**16; // Lower condition for including pool's tokens as part of burn during withdraw
    uint256 private constant FEE_BOUND = 200; // Max fee of 20%
    int256 private constant PERCENTAGE_BOUND = 10000; // Max 10x leverage

    event Balanced(address indexed strategy, uint256 totalBefore, uint256 totalAfter);
    event Deposit(address indexed strategy, address indexed account, uint256 value, uint256 amount);
    event Withdraw(address indexed strategy, address indexed account, uint256 value, uint256 amount);

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
        address[] calldata strategyDebt,
        address router,
        uint256 amount
    ) public {
        _approveSynthsAndDebt(strategy, strategyDebt, router, amount);
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
        IOracle oracle,
        address weth,
        uint256 rebalanceSlippage,
        bytes memory data
    ) public {
        _onlyApproved(address(router));
        strategy.settleSynths();
        (bool balancedBefore, uint256 totalBefore, int256[] memory estimates) = verifyBalance(strategy, oracle);
        require(!balancedBefore, "Balanced");
        if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
            data = abi.encode(totalBefore, estimates);
        // Rebalance
        _useRouter(strategy, router, router.rebalance, weth, data);
        // Recheck total
        (bool balancedAfter, uint256 totalAfter, ) = verifyBalance(strategy, oracle);
        require(balancedAfter, "Not balanced");
        _checkSlippage(totalAfter, totalBefore, rebalanceSlippage);
        strategy.updateTokenValue(totalAfter, strategy.totalSupply());
        emit Balanced(address(strategy), totalBefore, totalAfter);
    }

    function repositionSynths(IStrategy strategy, address adapter, address token, address susd) external {
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
        _onlyApproved(address(router));
        _checkDivisor(slippage);
        _approveSynthsAndDebt(strategy, strategy.debt(), address(router), uint256(-1));
        IOracle o = IStrategyController(address(this)).oracle();
        if (weth != address(0)) {
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
        require(totalAfter > totalBefore, "Lost value");
        checkBalance(address(strategy), balanceBefore, totalAfter, estimates);
        uint256 valueAdded = totalAfter - totalBefore; // Safe math not needed, already checking for underflow
        _checkSlippage(valueAdded, amount, slippage);
        uint256 relativeTokens;
        {
            uint256 totalSupply = strategy.totalSupply();
            relativeTokens =
                totalSupply > 0 ? totalSupply.mul(valueAdded).div(totalBefore) : totalAfter;
            require(relativeTokens > 0, "Insuffient tokens");
            strategy.updateTokenValue(totalAfter, totalSupply.add(relativeTokens));
            strategy.mint(account, relativeTokens);
        }
        emit Deposit(address(strategy), account, amount, relativeTokens);
    }

    /**
     * @notice Trade tokens for weth
     * @dev Calldata is only needed for the GenericRouter
     */
    function withdraw(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) public returns (address weth, uint256 wethAmount) {
        _onlyApproved(address(router));
        require(amount > 0, "0 amount");
        _checkDivisor(slippage);
        strategy.settleSynths();
        address pool = IStrategyController(address(this)).pool();
        uint256 poolWethAmount;
        uint256 totalBefore;
        uint256 balanceBefore;
        {
            int256[] memory estimatesBefore;
            (totalBefore, estimatesBefore) = IStrategyController(address(this)).oracle().estimateStrategy(strategy);
            balanceBefore = amountOutOfBalance(address(strategy), totalBefore, estimatesBefore);
            uint256 totalSupply;
            {
                totalSupply = strategy.totalSupply();
                // Handle fees and burn strategy tokens
                // since "this" is controller, then msg.sender is the correct entity
                // and burn is `onlyController`
                amount = strategy.burn(msg.sender, amount); // Old stategies will have a withdrawal fee, so amount needs to get updated
            }
            wethAmount = totalBefore.mul(amount).div(totalSupply);
            // Setup data
            if (router.category() != IStrategyRouter.RouterCategory.GENERIC){
                {
                    uint256 poolBalance = strategy.balanceOf(pool);
                    if (poolBalance > 0) {
                        // Have fee pool tokens piggy-back on the trades as long as they are within an acceptable percentage
                        uint256 feePercentage = poolBalance.mul(PRECISION).div(amount.add(poolBalance));
                        if (feePercentage > WITHDRAW_LOWER_BOUND && feePercentage < WITHDRAW_UPPER_BOUND) {
                            strategy.burn(pool, poolBalance); // Burn pool tokens since they will be getting traded
                            poolWethAmount = totalBefore.mul(poolBalance).div(totalSupply);
                            amount = amount.add(poolBalance); // Add pool balance to amount to determine percentage that will be passed to router
                        }
                    }
                }
                uint256 percentage = amount.mul(PRECISION).div(totalSupply);
                data = abi.encode(percentage, totalBefore, estimatesBefore);
            }
        }
        // Withdraw
        weth = IStrategyController(address(this)).weth();
        _useRouter(strategy, router, router.withdraw, weth, data);
        // Check value and balance
        (uint256 totalAfter, int256[] memory estimatesAfter) = IStrategyController(address(this)).oracle().estimateStrategy(strategy);
        {
            // Calculate weth amount
            uint256 wethBalance = IERC20(weth).balanceOf(address(strategy));
            wethBalance = wethBalance.sub(poolWethAmount); // Get balance after weth fees have been removed
            uint256 wethAfterSlippage;
            if (totalBefore > totalAfter) {
              uint256 slippageAmount = totalBefore.sub(totalAfter);
              require(slippageAmount < wethAmount, "Too much slippage");
              wethAfterSlippage = wethAmount - slippageAmount; // Subtract value loss from weth owed
            } else {
              // Value has increased, no slippage to subtract
              wethAfterSlippage = wethAmount;
            }
            if (wethAfterSlippage > wethBalance) {
                // If strategy's weth balance is less than weth owed, use balance as weth owed
                _checkSlippage(wethBalance, wethAmount, slippage);
                wethAmount = wethBalance;
            } else {
                _checkSlippage(wethAfterSlippage, wethAmount, slippage);
                wethAmount = wethAfterSlippage;
            }
            totalAfter = totalAfter.sub(wethAmount).sub(poolWethAmount);
        }
        checkBalance(address(strategy), balanceBefore, totalAfter, estimatesAfter);
        strategy.updateTokenValue(totalAfter, strategy.totalSupply());
        // Approve weth
        strategy.approveToken(weth, address(this), wethAmount.add(poolWethAmount));
        if (poolWethAmount > 0) {
            IERC20(weth).transferFrom(address(strategy), pool, poolWethAmount);
        }
        emit Withdraw(address(strategy), msg.sender, wethAmount, amount);
    }


    function self() external view returns(address) {
        // for sanity checks.. see controller init
        return address(this);
    }

    // @notice Checks that there is no debt remaining for tokens that are no longer part of the strategy
    function verifyFormerDebt(address strategy, address[] calldata newDebt, address[] memory formerDebt) public view {
        formerDebt = formerDebt.without(newDebt);
        uint256 balance;
        for (uint256 i; i < formerDebt.length; ++i) {
            balance = IERC20(formerDebt[i]).balanceOf(strategy);
            require(balance == 0, "Former debt remaining");
        }
    }

    /**
     * @notice This function gets the strategy value from the oracle and checks
     *         whether the strategy is balanced. Necessary to confirm the balance
     *         before and after a rebalance to ensure nothing fishy happened
     */
    function verifyBalance(IStrategy strategy, IOracle oracle) public view returns (bool, uint256, int256[] memory) {
        (uint256 total, int256[] memory estimates) =
            oracle.estimateStrategy(IStrategy(strategy));
        uint256 threshold = strategy.rebalanceThreshold();

        bool balanced = true;
        address[] memory strategyItems = strategy.items();
        for (uint256 i = 0; i < strategyItems.length; i++) {
            int256 expectedValue = StrategyLibrary.getExpectedTokenValue(total, address(strategy), strategyItems[i]);
            if (expectedValue > 0) {
                int256 rebalanceRange = StrategyLibrary.getRange(expectedValue, threshold);
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
                if (estimates[i] > StrategyLibrary.getRange(int256(total), 1)) {
                    balanced = false;
                    break;
                }
            }
        }
        if (balanced) {
            address[] memory strategyDebt = strategy.debt();
            for (uint256 i = 0; i < strategyDebt.length; i++) {
              int256 expectedValue = StrategyLibrary.getExpectedTokenValue(total, address(strategy), strategyDebt[i]);
              int256 rebalanceRange = StrategyLibrary.getRange(expectedValue, threshold);
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
            int256 expectedValue = StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItems[i]);
            if (estimates[i] > expectedValue) {
                amount = amount.add(uint256(estimates[i].sub(expectedValue)));
            } else if (estimates[i] < expectedValue) {
                amount = amount.add(uint256(expectedValue.sub(estimates[i])));
            }
        }
        address[] memory strategyDebt = IStrategy(strategy).debt();
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            int256 expectedValue = StrategyLibrary.getExpectedTokenValue(total, strategy, strategyDebt[i]);
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

    function verifyStructure(address strategy, StrategyTypes.StrategyItem[] memory newItems)
        public
        view
        returns (bool)
    {
        require(newItems.length > 0, "Cannot set empty structure");
        require(newItems[0].item != address(0), "Invalid item addr"); //Everything else will be caught by the ordering _requirement below
        require(newItems[newItems.length-1].item != address(-1), "Invalid item addr"); //Reserved space for virtual item

        ITokenRegistry registry = IStrategyController(address(this)).oracle().tokenRegistry();

        bool supportsSynths;
        bool supportsDebt;

        int256 total;
        address item;
        for (uint256 i; i < newItems.length; ++i) {
            item = newItems[i].item;
            require(i == 0 || newItems[i].item > newItems[i - 1].item, "Item ordering");
            int256 percentage = newItems[i].percentage;
            uint256 itemCategory = registry.itemCategories(item);
            if (itemCategory == uint256(StrategyTypes.ItemCategory.DEBT)) {
              supportsDebt = true;
              require(percentage <= 0, "Debt cannot be positive");
              require(percentage >= -PERCENTAGE_BOUND, "Out of bounds");
            } else {
              if (itemCategory == uint256(StrategyTypes.ItemCategory.SYNTH))
                  supportsSynths = true;
              require(percentage >= 0, "Token cannot be negative");
              require(percentage <= PERCENTAGE_BOUND, "Out of bounds");
            }
            uint256 estimatorCategory = registry.estimatorCategories(item);
            require(estimatorCategory != uint256(StrategyTypes.EstimatorCategory.BLOCKED), "Token blocked");
            if (estimatorCategory == uint256(StrategyTypes.EstimatorCategory.STRATEGY))
                _checkCyclicDependency(strategy, IStrategy(item), registry);
            total = total.add(percentage);
        }
        require(!(supportsSynths && supportsDebt), "No synths and debt");
        require(total == int256(DIVISOR), "Total percentage wrong");
        return true;
    }

    /**
     * @notice Checks that router is whitelisted
     */
    function _onlyApproved(address account) private view {
        require(IStrategyController(address(this)).whitelist().approved(account), "Not approved");
    }

    function _checkSlippage(uint256 slippedValue, uint256 referenceValue, uint256 slippage) private pure {
      require(
          slippedValue >= referenceValue.mul(slippage) / uint256(DIVISOR),
          "Too much slippage"
      );
    }

    function _checkCyclicDependency(address test, IStrategy strategy, ITokenRegistry registry) private view {
        require(address(strategy) != test, "Cyclic dependency");
        require(!strategy.supportsSynths(), "Synths not supported");
        address[] memory strategyItems = strategy.items();
        for (uint256 i; i < strategyItems.length; ++i) {
          if (registry.estimatorCategories(strategyItems[i]) == uint256(StrategyTypes.EstimatorCategory.STRATEGY))
              _checkCyclicDependency(test, IStrategy(strategyItems[i]), registry);
        }
    }

    function _checkDivisor(uint256 value) private pure {
        require(value <= uint256(DIVISOR), "Out of bounds");
    }
}
