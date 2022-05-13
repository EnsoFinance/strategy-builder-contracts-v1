//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../libraries/StrategyLibrary.sol";
import "../libraries/BinaryTreeWithPayload.sol";
import "./StrategyRouter.sol";

contract LoopRouter is StrategyTypes, StrategyRouter {
    using BinaryTreeWithPayload for BinaryTreeWithPayload.Tree;

    constructor(address controller_) public StrategyRouter(RouterCategory.LOOP, controller_) {}

    function deposit(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        (address depositor, uint256 amount) =
            abi.decode(data, (address, uint256));
        address[] memory strategyItems = IStrategy(strategy).items();
        int256[] memory estimates = new int256[](strategyItems.length);
        _batchBuy(
          strategy,
          depositor,
          amount,
          estimates,
          strategyItems
        );
    }

    function withdraw(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        (uint256 expectedWeth, uint256[] memory diffs, bytes[] memory payloads) = _getSortedDiffs(strategy, data);
        // Sell loop
        uint256 diff;
        address strategyItem;
        int256 estimate;
        uint256 i;
        while (expectedWeth > 0 && i < payloads.length) {
            diff = diffs[i];
            if (diff > expectedWeth) {
                diff = expectedWeth;
                expectedWeth = 0; 
            } else {
                expectedWeth = expectedWeth-diff;  // since expectedWeth >= diff
            }
            (strategyItem, estimate) = abi.decode(payloads[i], (address, int256));
            TradeData memory tradeData = IStrategy(strategy).getTradeData(strategyItem);
            _sellPath(
              tradeData,
              _estimateSellAmount(strategy, strategyItem, diff, uint256(estimate)),
              strategyItem,
              strategy
            ); 
            ++i;
        }
    }

    function rebalance(address strategy, bytes calldata data) external override onlyController {
        (uint256 total, int256[] memory estimates) = abi.decode(data, (uint256, int256[]));
        address[] memory strategyItems = IStrategy(strategy).items();
        int256[] memory buy = new int256[](strategyItems.length);
        // Sell loop
        for (uint256 i = 0; i < strategyItems.length; ++i) {
            int expected = StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItems[i]);
            if (!_sellToken(
                    strategy,
                    strategyItems[i],
                    estimates[i],
                    expected
                )
            ) buy[i] = expected;
            // semantic overloading to cache `expected` since it will be used in next loop.
        }
        // Buy loop
        for (uint256 i = 0; i < strategyItems.length; ++i) {
            if (buy[i] != 0) {
                _buyToken(
                    strategy,
                    strategy,
                    strategyItems[i],
                    estimates[i],
                    buy[i]
                );
            }
        }
    }

    function restructure(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        (
          uint256 currentTotal,
          int256[] memory currentEstimates,
          address[] memory currentItems
        ) = abi.decode(data, (uint256, int256[], address[]));

        _batchSell(strategy, currentTotal, currentEstimates, currentItems);
        (uint256 newTotal, int256[] memory newEstimates) = IStrategy(strategy).oracle().estimateStrategy(IStrategy(strategy));
        address[] memory newItems = IStrategy(strategy).items();
        _batchBuy(strategy, strategy, newTotal, newEstimates, newItems);
    }

    function _batchSell(
        address strategy,
        uint256 total,
        int256[] memory estimates,
        address[] memory strategyItems
    ) internal {
        for (uint256 i = 0; i < strategyItems.length; ++i) {
            // Convert funds into Ether
            address strategyItem = strategyItems[i];
            if (IStrategy(strategy).getPercentage(strategyItem) == 0) {
                //Sell all tokens that have 0 percentage
                _sellPath(
                    IStrategy(strategy).getTradeData(strategyItem),
                    IERC20(strategyItem).balanceOf(strategy),
                    strategyItem,
                    strategy
                );
            } else {
                //Only sell if above rebalance threshold
                _sellToken(
                    strategy,
                    strategyItem,
                    estimates[i],
                    StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItem)
                );
            }
        }
    }

    function _batchBuy(
        address strategy,
        address from,
        uint256 total,
        int256[] memory estimates,
        address[] memory strategyItems
    ) internal {
        for (uint256 i = 0; i < strategyItems.length; ++i) {
            address strategyItem = strategyItems[i];
            _buyToken(
                strategy,
                from,
                strategyItem,
                estimates[i],
                StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItem)
            );
        }
        int256 percentage = IStrategy(strategy).getPercentage(weth);
        if (percentage > 0 && from != strategy) {
            if (from == address(this)) {
              // Send all WETH
              IERC20(weth).safeTransfer(strategy, IERC20(weth).balanceOf(from));
            } else {
              // Calculate remaining WETH
              // Since from is not address(this), we know this is a deposit, so estimated value not relevant
              uint256 amount =
                  total.mul(uint256(percentage))
                       .div(DIVISOR);
              IERC20(weth).safeTransferFrom(
                  from,
                  strategy,
                  amount
              );
            }
        }
    }

    function _sellToken(
        address strategy,
        address token,
        int256 estimatedValue,
        int256 expectedValue
    ) internal returns (bool) {
        int256 rebalanceRange =
            StrategyLibrary.getRange(
                expectedValue,
                IStrategy(strategy).rebalanceThreshold()
            );
        if (estimatedValue > expectedValue.add(rebalanceRange)) {
            TradeData memory tradeData = IStrategy(strategy).getTradeData(token);
            _sellPath(
                tradeData,
                _estimateSellAmount(strategy, token, uint256(estimatedValue.sub(expectedValue)), uint256(estimatedValue)),
                token,
                strategy
            );
            return true;
        }
        return false;
    }

    function _buyToken(
        address strategy,
        address from,
        address token,
        int256 estimatedValue,
        int256 expectedValue
    ) internal {
        int256 amount;
        if (estimatedValue == 0) {
            amount = expectedValue;
        } else {
            int256 rebalanceRange =
                StrategyLibrary.getRange(
                    expectedValue,
                    IStrategy(strategy).rebalanceThreshold()
                );
            if (estimatedValue < expectedValue.sub(rebalanceRange)) {
                amount = expectedValue.sub(estimatedValue);
            }
        }
        if (amount > 0) {
            uint256 balance = IERC20(weth).balanceOf(from);
            _buyPath(
                IStrategy(strategy).getTradeData(token),
                uint256(amount) > balance ? balance : uint256(amount),
                token,
                strategy,
                from
            );
        }
    }

    function _getSortedDiffs(address strategy, bytes calldata data) private view returns(uint256 expectedWeth, uint256[] memory diffs, bytes[] memory payloads) {
        uint256 total;
        int256[] memory estimates;
        {
            uint256 percentage;
            (percentage, total, estimates) =
                abi.decode(data, (uint256, uint256, int256[]));
            expectedWeth = total.mul(percentage).div(10**18);
            total = total.sub(expectedWeth);
        }
        address[] memory strategyItems = IStrategy(strategy).items();
        BinaryTreeWithPayload.Tree memory tree = BinaryTreeWithPayload.newNode();
        int256 expectedValue;
        uint256 numberAdded;
        
        for (uint256 i; i<strategyItems.length; ++i) {
            expectedValue = StrategyLibrary.getExpectedTokenValue(
                total,
                strategy,
                strategyItems[i]
            );
            int256 estimatedValue = estimates[i];
            if (estimatedValue > expectedValue) {
                // condition check above means adding diff that isn't overflowed
                tree.add(uint256(estimatedValue-expectedValue), abi.encode(strategyItems[i], estimates[i]));
                ++numberAdded;
            }
        }
        diffs = new uint256[](numberAdded+1); // +1 is for length entry. see `BinaryTreeWithPayload.readInto`
        payloads = new bytes[](numberAdded);
        tree.readInto(diffs, payloads);
    }

}
