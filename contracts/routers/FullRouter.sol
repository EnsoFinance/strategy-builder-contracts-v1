//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IBaseAdapter.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/aave/ILendingPool.sol";
import "../interfaces/aave/ILendingPoolAddressesProvider.sol";
import "../libraries/StrategyLibrary.sol";
import "../libraries/BinaryTreeWithPayload.sol";
import "../libraries/MemoryMappings.sol";
import "./StrategyRouter.sol";

import "../interfaces/aave/IAToken.sol";

import "hardhat/console.sol";

struct LeverageItem {
  address token;
  uint16 percentage;
}

contract FullRouter is StrategyTypes, StrategyRouter {
    using BinaryTreeWithPayload for BinaryTreeWithPayload.Tree;
    using MemoryMappings for BinaryTreeWithPayload.Tree;

    ILendingPoolAddressesProvider public immutable addressesProvider;
    address public immutable susd;
    bytes32 private constant STRATEGY_DEBT_KEY = keccak256(abi.encode("strategyDebt"));

    constructor(address addressesProvider_, address controller_) public StrategyRouter(RouterCategory.LOOP, controller_) {
        addressesProvider = ILendingPoolAddressesProvider(addressesProvider_);
        susd = IStrategyController(controller_).oracle().susd();
    }

    function deposit(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        (address depositor, uint256 amount) =
            abi.decode(data, (address, uint256));
        address[] memory strategyItems = IStrategy(strategy).items();
        address[] memory strategyDebt = IStrategy(strategy).debt();
        int256[] memory estimates = new int256[](strategyItems.length + strategyDebt.length + 1);
        _batchBuy(
          strategy,
          depositor,
          amount,
          estimates,
          strategyItems,
          strategyDebt,
          BinaryTreeWithPayload.newNode() // memory mapping
        );
    }

    function withdraw(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        BinaryTreeWithPayload.Tree memory mm = _startTempEstimateSession();

        uint256 expectedWeth;
        uint256[] memory diffs;
        bytes[] memory payloads;
        {
            uint256 total;
            int256[] memory estimates;
            (expectedWeth, total, estimates) = _getExpectedWeth(data);
            address[] memory strategyItems = IStrategy(strategy).items();

            // Deleverage debt
            _deleverageForWithdraw(strategy, estimates, total, expectedWeth, strategyItems.length, mm);
            // Sort diffs for capital efficiency
            (diffs, payloads) = _getSortedDiffs(strategy, strategyItems, estimates, total, mm);
        }

        if (expectedWeth == 0 || payloads.length == 0) return;
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
            _sellPath(
                IStrategy(strategy).getTradeData(strategyItem),
                _estimateSellAmount(strategy, strategyItem, diff, uint256(estimate)),
                strategyItem,
                strategy
            );
            ++i;
        }
    }

    function rebalance(address strategy, bytes calldata data) external override onlyController {
        BinaryTreeWithPayload.Tree memory mm = _startTempEstimateSession();
        (uint256 total, int256[] memory estimates) = abi.decode(data, (uint256, int256[]));
        address[] memory strategyItems = IStrategy(strategy).items();
        address[] memory strategyDebt = IStrategy(strategy).debt();
        // Deleverage debt
        for (uint256 i; i < strategyDebt.length; ++i) {
            _repayToken(
                strategy,
                strategyDebt[i],
                total,
                estimates[strategyItems.length + i],
                mm
            );
        }
        // Sell loop
        int256[] memory buy = new int256[](strategyItems.length);
        address strategyItem;
        int256 expected;
        for (uint256 i; i < strategyItems.length; ++i) {
            strategyItem = strategyItems[i];
            int256 estimate = estimates[i];
            if (_getTempEstimate(mm, strategy, strategyItem) > 0) {
                estimate = _getTempEstimate(mm, strategy, strategyItem);
                _removeTempEstimate(mm, strategy, strategyItem);
            }
            expected = StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItem);
            if (!_sellToken(
                    strategy,
                    strategyItem,
                    estimate,
                    expected
                )
            ) buy[i] = expected;
            // semantic overloading to cache `expected` since it will be used in next loop.
        }
        // Buy loop
        for (uint256 i; i < strategyItems.length; ++i) {
            if (buy[i] != 0) {
                strategyItem = strategyItems[i];
                expected = buy[i];
                _buyToken(
                    strategy,
                    strategy,
                    strategyItem,
                    estimates[i],
                    expected
                );
            }
        }
        if (IStrategy(strategy).supportsSynths()) _batchBuySynths(strategy, total);
        // Leverage debt
        for (uint256 i; i < strategyDebt.length; ++i) {
            _borrowToken(
                strategy,
                strategyDebt[i],
                total,
                estimates[strategyItems.length + i],
                mm
            );
        }
    }

    function restructure(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        BinaryTreeWithPayload.Tree memory mm = _startTempEstimateSession();
        (
          uint256 currentTotal,
          int256[] memory currentEstimates,
          address[] memory currentItems,
          address[] memory currentDebt
        ) = abi.decode(data, (uint256, int256[], address[], address[]));

        _batchSell(strategy, currentTotal, currentEstimates, currentItems, currentDebt, mm);
        (uint256 newTotal, int256[] memory newEstimates) = controller.oracle().estimateStrategy(IStrategy(strategy));
        address[] memory newItems = IStrategy(strategy).items();
        address[] memory newDebt = IStrategy(strategy).debt();
        _batchBuy(strategy, strategy, newTotal, newEstimates, newItems, newDebt, mm);
    }

    function _batchSell(
        address strategy,
        uint256 total,
        int256[] memory estimates,
        address[] memory strategyItems,
        address[] memory strategyDebt,
        BinaryTreeWithPayload.Tree memory mm
    ) internal {
        int256 estimate;
        for (uint256 i; i < strategyDebt.length; ++i) {
            estimate = estimates[strategyItems.length + i];
            //Repay all debt that has 0 percentage
            if (IStrategy(strategy).getPercentage(strategyDebt[i]) == 0) {
                mm.add(STRATEGY_DEBT_KEY, abi.encode(strategyDebt[i]));
                TradeData memory td = IStrategy(strategy).getTradeData(strategyDebt[i]);
                _repayPath(
                    td,
                    type(uint256).max, // max it out
                    total,
                    strategy,
                    mm
                );
                mm.add(STRATEGY_DEBT_KEY, bytes32(0));
                _returnRemainderToStrategy(td, strategy);
            } else {
                //Only repay if above rebalance threshold
                _repayToken(
                    strategy,
                    strategyDebt[i],
                    total,
                    estimate,
                    mm
                );
            }
        }
        address strategyItem;
        for (uint256 i; i < strategyItems.length; ++i) {
            // Convert funds into Ether
            strategyItem = strategyItems[i];
            estimate = estimates[i];
            if (_getTempEstimate(mm, strategy, strategyItem) > 0) {
                estimate = _getTempEstimate(mm, strategy, strategyItem);
                _removeTempEstimate(mm, strategy, strategyItem);
            }
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
                    estimate,
                    StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItem)
                );
            }
        }
        if (IStrategy(strategy).supportsSynths()) {
            // Sell SUSD
            _sellToken(
                strategy,
                susd,
                estimates[estimates.length - 1], // Virtual item always at end of estimates
                StrategyLibrary.getExpectedTokenValue(total, strategy, address(-1))
            );
        }
    }

    function _batchBuy(
        address strategy,
        address from,
        uint256 total,
        int256[] memory estimates,
        address[] memory strategyItems,
        address[] memory strategyDebt,
        BinaryTreeWithPayload.Tree memory mm
    ) internal {
        for (uint256 i; i < strategyItems.length; ++i) {
            _buyToken(
                strategy,
                from,
                strategyItems[i],
                estimates[i],
                StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItems[i])
            );
        }
        if (IStrategy(strategy).supportsSynths()) {
            // Purchase SUSD
            uint256 susdBalanceBefore = from == strategy ? 0 : IERC20(susd).balanceOf(strategy); // If from strategy it is rebalance or restructure, we want to use all SUSD
            _buyToken(
                strategy,
                from,
                susd,
                estimates[estimates.length - 1],
                StrategyLibrary.getExpectedTokenValue(total, strategy, address(-1))
            );
            uint256 susdBalanceAfter = IERC20(susd).balanceOf(strategy);
            _batchBuySynths(strategy, susdBalanceAfter.sub(susdBalanceBefore));
        }
        for (uint256 i; i < strategyDebt.length; ++i) {
            _borrowToken(
                strategy,
                strategyDebt[i],
                total,
                estimates[strategyItems.length + i],
                mm
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

    function _batchBuySynths(address strategy, uint256 susdBalance) internal {
        // Use SUSD to purchase other synths
        uint256 virtualPercentage = uint256(IStrategy(strategy).getPercentage(address(-1)));
        address[] memory synths = IStrategy(strategy).synths();
        if (synths.length == 0) return;
        uint256 percentage;
        uint256 amount;
        for (uint256 i; i < synths.length; ++i) {
            percentage = uint256(IStrategy(strategy).getPercentage(synths[i]));
            if (percentage != 0) {
                amount = susdBalance.mul(percentage).div(virtualPercentage);
                _delegateSwap(
                    IStrategy(strategy).getTradeData(synths[i]).adapters[0], // Assuming that synth only stores single SythetixAdapter
                    amount,
                    1,
                    susd,
                    synths[i],
                    strategy,
                    strategy
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
            _sellPath(
                IStrategy(strategy).getTradeData(token),
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
        // Note: it is possible for a restructure to have an estimated value of zero,
        // but only if it's expected value is also zero, in which case this function
        // will end without making a purchase. So it is safe to set `isDeposit` this way
        bool isDeposit = estimatedValue == 0;
        if (isDeposit) {
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
            TradeData memory tradeData = IStrategy(strategy).getTradeData(token);
            if (tradeData.cache.length > 0) {
                //Apply multiplier
                uint16 multiplier = abi.decode(tradeData.cache, (uint16));
                amount = amount.mul(int256(multiplier)).div(int256(DIVISOR));
            }
            uint256 balance = IERC20(weth).balanceOf(from);
            _buyPath(
                tradeData,
                uint256(amount) > balance ? balance : uint256(amount),
                token,
                strategy,
                from
            );
        }
    }

    function _repayToken(
        address strategy,
        address token,
        uint256 total,
        int256 estimatedValue,
        BinaryTreeWithPayload.Tree memory mm
    ) internal {
        int256 expectedValue = StrategyLibrary.getExpectedTokenValue(total, strategy, token);
        int256 rebalanceRange =
            StrategyLibrary.getRange(
                expectedValue,
                IStrategy(strategy).rebalanceThreshold()
            );
        TradeData memory tradeData = IStrategy(strategy).getTradeData(token);
        // We still call _repayPath even if amountInWeth == 0 because we need to check if leveraged tokens need to be deleveraged
        uint256 amountInWeth = estimatedValue < expectedValue.add(rebalanceRange) ? uint256(-estimatedValue.sub(expectedValue)) : 0;
        _repayPath(
            tradeData,
            amountInWeth,
            total,
            strategy,
            mm
        );
    }

    function _borrowToken(
        address strategy,
        address token,
        uint256 total,
        int256 estimatedValue,
        BinaryTreeWithPayload.Tree memory mm
    ) internal {
        int256 expectedValue = StrategyLibrary.getExpectedTokenValue(total, strategy, token);
        int256 amountInWeth;
        bool isDeposit = estimatedValue == 0;
        if (isDeposit) {
            amountInWeth = expectedValue;
        } else {
            int256 rebalanceRange =
                StrategyLibrary.getRange(
                    expectedValue,
                    IStrategy(strategy).rebalanceThreshold()
                );
            if (estimatedValue > expectedValue.sub(rebalanceRange)) {
                amountInWeth = expectedValue.sub(estimatedValue);
            }
        }
        if (amountInWeth < 0) {
            _borrowPath(
                IStrategy(strategy).getTradeData(token),
                uint256(-amountInWeth),
                total,
                strategy,
                isDeposit,
                mm
            );
        }
    }

    function _repayPath(
        TradeData memory data,
        uint256 amount, // weth
        uint256 total,
        address strategy,
        BinaryTreeWithPayload.Tree memory mm
    ) internal {
        if (amount == 0 && (data.path[data.path.length-1] != weth || data.cache.length == 0)) return; // Debt doesn't need to change and no leverage tokens to deleverage so return
        // Debt trade paths should have path.length == adapters.length,
        // since final token can differ from the debt token defined in the strategy
        require(data.adapters.length == data.path.length, "Incorrect trade data");
        IOracle oracle = controller.oracle();
        LeverageItem[] memory leverageItems;
        uint256[] memory leverageLiquidity;

        if (data.path[data.path.length-1] != weth) {
            // Convert amount into the first token's currency
            // FIXME maxing out amount will cause overflow throw here
            amount = amount.mul(10**18).div(uint256(oracle.estimateItem(10**18, data.path[data.path.length-1])));
        } else if (data.cache.length > 0) {
            // Deleverage tokens
            leverageItems = abi.decode(data.cache, (LeverageItem[]));
            leverageLiquidity = new uint256[](leverageItems.length);
            if (amount == 0) {
                // Special case where debt doesn't need to change but the relative amounts of leverage tokens do. We must first deleverage our debt
                for (uint256 i = 0; i < leverageItems.length; i++) {
                    leverageLiquidity[i] = _getLeverageRemaining(oracle, strategy, leverageItems[i].token, total, false, mm);
                    amount = amount.add(leverageLiquidity[i]);
                }
            } else {
                uint256 leverageAmount = amount; // amount is denominated in weth here
                address token;
                for (uint256 i; i < leverageItems.length; ++i) {
                    token = leverageItems[i].token;
                    if (leverageItems.length > 1) { //If multiple leveraged items, some may have less liquidity than the total amount we need to sell
                        uint256 liquidity = _getLeverageRemaining(oracle, strategy, token, total, false, mm);
                        leverageLiquidity[i] = leverageAmount > liquidity ? liquidity : leverageAmount;
                    } else {
                        leverageLiquidity[i] = leverageAmount;
                        _setTempEstimate(
                          mm, 
                          strategy, 
                          token, 
                          oracle.estimateItem(
                            IERC20(token).balanceOf(strategy),
                            token
                          )
                        );
                    }
                    leverageAmount = leverageAmount.sub(leverageLiquidity[i]);
                }
                // FIXME this throws when using uint256.max
                //assert(leverageAmount == 0);
            }
        }

        ILendingPool lendingPool = ILendingPool(addressesProvider.getLendingPool());
        while (amount > 0) {
            if (leverageItems.length > 0) {
                // Leverage tokens: cache can contain an array of tokens that can be purchased with the WETH received from selling debt
                ( , , uint256 availableBorrowsETH, , , ) = lendingPool.getUserAccountData(strategy);
                bool isLiquidityRemaining = false;
                uint256 leverageAmount;
                for (uint256 i; i < leverageItems.length; ++i) {
                    if (leverageLiquidity[i] > 0 && availableBorrowsETH > 0) {
                        // Only deleverage token when there is a disparity between the expected value and the estimated value
                        leverageAmount = _deleverage(oracle, strategy, leverageItems[i].token, leverageLiquidity[i], availableBorrowsETH, mm);
                        leverageLiquidity[i] = leverageLiquidity[i].sub(leverageAmount);
                        availableBorrowsETH = availableBorrowsETH.sub(leverageAmount);
                        if (leverageLiquidity[i] > 0) isLiquidityRemaining = true; // Liquidity still remaining
                    }
                }
                if (!isLiquidityRemaining) {
                    // In case of deleveraging slippage, once we've fully deleveraged we just want use the weth the we've received even if its less than original amount
                    uint256 balance = IERC20(weth).balanceOf(strategy);
                    if (amount > balance) amount = balance;
                }
            }
            uint256 _amount;
            address _tokenIn;
            address _tokenOut;
            address _from;
            address _to;
            for (int256 i = int256(data.adapters.length-1); i >= 0; --i) { //this doesn't work with uint256?? wtf solidity
                _tokenIn = data.path[uint256(i)];
                if (uint256(i) == data.adapters.length-1) {
                    uint256 balance = IERC20(_tokenIn).balanceOf(strategy);
                    _amount = balance > amount ? amount : balance;
                    _from = strategy;
                    //Update amounts
                    amount = SafeMath.sub(amount, _amount); // a.sub(b) causes stack-too-deep and costs more in gas
                } else {
                    _from = address(this);
                    _amount = IERC20(_tokenIn).balanceOf(_from);
                }
                if (_amount > 0) {
                    if (uint256(i) == 0) {
                        _tokenOut = address(0); //Since we're repaying to the lending pool we'll set tokenOut to zero, however amount is valued in weth
                        _to = strategy;
                    } else {
                        _tokenOut = data.path[uint256(i-1)];
                        _to = address(this);
                    }
                    _delegateSwap(
                        data.adapters[uint256(i)],
                        _amount,
                        1,
                        _tokenIn,
                        _tokenOut,
                        _from,
                        _to
                    );
                }
            }
            if (amount != 0) {
                (bool ok, bytes memory result) = mm.getValue(STRATEGY_DEBT_KEY);
                if (!ok) {
                    continue;
                }
                address strategyDebt = abi.decode(result, (address));
                if (IERC20(strategyDebt).balanceOf(strategy) == 0) break;
            }
        }
    }

    function _returnRemainderToStrategy(TradeData memory data, address strategy) private {
        if (data.path.length < 2 || data.path[data.path.length-1] != weth || IERC20(data.path[0]).balanceOf(address(this)) == 0) return;
        uint256 _amount;
        address _tokenIn;
        address _tokenOut;
        address _from;
        address _to;
        for (uint256 i; i < data.path.length-1; ++i) {
        //for (int256 i = int256(data.adapters.length-1); i >= 0; --i) { //this doesn't work with uint256?? wtf solidity
            _tokenIn = data.path[uint256(i)];
            _from = address(this);
            _amount = IERC20(_tokenIn).balanceOf(_from);
            if (_amount > 0) {
                _tokenOut = data.path[uint256(i+1)];
                if (i == data.path.length-2) {
                    _to = strategy;
                } else {
                    _to = address(this);
                }
                _delegateSwap(
                    data.adapters[uint256(i+1)],
                    _amount,
                    1,
                    _tokenIn,
                    _tokenOut,
                    _from,
                    _to
                );
            }
        }
    }

    function _borrowPath(
        TradeData memory data,
        uint256 amount, // weth
        uint256 total,
        address strategy,
        bool isDeposit,
        BinaryTreeWithPayload.Tree memory mm
    ) internal {
        // Debt trade paths should have path.length == adapters.length,
        // since final token can differ from the debt token defined in the strategy
        require(data.adapters.length == data.path.length, "Incorrect trade data");
        ILendingPool lendingPool = ILendingPool(addressesProvider.getLendingPool());
        LeverageItem[] memory leverageItems;
        uint256[] memory leverageLiquidity;

        if (data.path[data.path.length-1] == weth && data.cache.length > 0) {
            leverageItems = abi.decode(data.cache, (LeverageItem[]));
            leverageLiquidity = new uint256[](leverageItems.length);
            if (isDeposit) {
              for (uint256 i; i < leverageItems.length; ++i) {
                  leverageLiquidity[i] = _getLeveragePercentage(strategy, leverageItems[i].token, leverageItems[i].percentage, total);
              }
            } else {
              IOracle oracle = controller.oracle();
              for (uint256 i; i < leverageItems.length; ++i) {
                  leverageLiquidity[i] = _getLeverageRemaining(oracle, strategy, leverageItems[i].token, total, true, mm);
              }
            }
        }

        if (amount == 0) return;
        uint256 availableBorrowsETH;
        bool lastItem;
        uint256 leverageAmount;
        while (amount > 0) { //First loop must either borrow the entire amount or add more tokens as collateral in order to borrow more on following loops
            ( , , availableBorrowsETH, , , ) = lendingPool.getUserAccountData(strategy);
            amount = _amountFromBorrowPath(data, amount, strategy, availableBorrowsETH, leverageItems);
            console.log("after _amountFromBorrowPath");
            if (leverageItems.length > 0) {
                // Leverage tokens: cache can contain an array of tokens that can be purchased with the WETH received from selling debt
                // Only purchase token when there is a disparity between the expected value and the estimated value
                for (uint256 i; i < leverageItems.length; ++i) {
                    // Since we're inside a while loop, the last item will be when `amount` == 0
                    lastItem = amount == 0 && i == leverageItems.length - 1;
                    if (leverageLiquidity[i] > 0 || lastItem) {
                        leverageAmount = _leverage(strategy, leverageItems[i].token, leverageLiquidity[i], lastItem);
                        if (leverageAmount > leverageLiquidity[i]) {
                            // Sometimes we may pay more than needed such as when we reach the lastItem
                            // and we use the remaining weth (rather than leave it in this contract) so
                            // just set to zero
                            leverageLiquidity[i] = 0;
                        } else {
                            // If leverageLiquidity remains, it means there wasn't enough weth to reach
                            // the expected amount, the remained will be handled on subsequent loops of
                            // the parent while loop
                            leverageLiquidity[i] = leverageLiquidity[i].sub(leverageAmount);
                        }
                    }
                }
            }
        }
    }

    function _amountFromBorrowPath(
        TradeData memory data,
        uint256 amount, // weth
        address strategy,
        uint256 availableBorrowsETH,
        LeverageItem[] memory leverageItems
    ) private returns(uint256) { // needed for scoping issues
            address[] memory adapters = data.adapters;
            uint256 adaptersLength = adapters.length;
            uint256 _amount;
            address _tokenIn;
            address _tokenOut;
            address _from;
            address _to;
            console.log("_amountFromBorrowPath");
            for (uint256 i; i < adaptersLength; ++i) {
              console.log(i);
                _tokenOut = data.path[i];
                if (i == 0) {
                    _tokenIn = address(0); //Since we are withdrawing from lendingPool's collateral reserves, we can set tokenIn to zero. However, amount will be valued in weth
                    _amount = availableBorrowsETH > amount ? amount : availableBorrowsETH;
                    _from = strategy;
                    //Update amount
                    amount = amount.sub(_amount);
                } else {
                    _tokenIn = data.path[i-1];
                    _from = address(this);
                    _amount = IERC20(_tokenIn).balanceOf(_from);
                }
                if (_amount > 0) {
                    if (i == adaptersLength-1 && leverageItems.length == 0) {
                        _to = strategy;
                    } else {
                        _to = address(this);
                    }
                    _delegateSwap(
                        adapters[i],
                        _amount,
                        1,
                        _tokenIn,
                        _tokenOut,
                        _from,
                        _to
                    );
                }
            }
            return amount;
    }

    function _getLeveragePercentage(
      address strategy,
      address leverageItem,
      uint256 leveragePercentage,
      uint256 total
    ) internal view returns (uint256) {
      int256 expected = StrategyLibrary.getExpectedTokenValue(total, strategy, leverageItem);
      return uint256(expected).mul(leveragePercentage).div(DIVISOR);
    }

    function _getLeverageRemaining(
        IOracle oracle,
        address strategy,
        address leverageItem,
        uint256 total,
        bool isLeveraging,
        BinaryTreeWithPayload.Tree memory mm
    ) internal view returns (uint256) {
        int256 expected = StrategyLibrary.getExpectedTokenValue(total, strategy, leverageItem);
        int256 estimate = oracle.estimateItem(
            IERC20(leverageItem).balanceOf(strategy),
            leverageItem
        );
        if (isLeveraging) {
            if (expected > estimate) return uint256(expected.sub(estimate));
        } else {
            _setTempEstimate(mm, strategy, leverageItem, estimate); // Store this value for _deleverage()
            if (estimate > expected) return uint256(estimate.sub(expected));
        }
        return 0;
    }

    function _leverage(
        address strategy,
        address leverageItem,
        uint256 leverageLiquidity,
        bool lastItem
    ) internal returns (uint256) {
        uint256 wethBalance = IERC20(weth).balanceOf(address(this));
        if (wethBalance > 0) {
            uint256 leverageAmount;
            if (lastItem) {
                // If it is the last item being leveraged, use all remaining weth
                leverageAmount = wethBalance;
            } else {
                leverageAmount = leverageLiquidity > wethBalance ? wethBalance : leverageLiquidity;
            }
            _buyPath(
                IStrategy(strategy).getTradeData(leverageItem),
                leverageAmount,
                leverageItem,
                strategy,
                address(this)
            );
            return leverageAmount;
        }
    }

    function _deleverage(
        IOracle oracle,
        address strategy,
        address leverageItem,
        uint256 leverageLiquidity,
        uint256 available,
        BinaryTreeWithPayload.Tree memory mm
    ) internal returns (uint256) {
        uint256 leverageAmount = leverageLiquidity > available ? available : leverageLiquidity;
        uint256 leverageEstimate = uint256(_getTempEstimate(mm, strategy, leverageItem)); //Set in _getLeverageRemaining
        require(leverageEstimate > 0, "Insufficient collateral");
        _sellPath(
            IStrategy(strategy).getTradeData(leverageItem),
            _estimateSellAmount(strategy, leverageItem, leverageAmount, leverageEstimate),
            leverageItem,
            strategy
        );
        // Update temp estimates with new value since tokens have been sold (it will be needed on later sell loops)
        _setTempEstimate(mm, strategy, leverageItem, oracle.estimateItem(
            IERC20(leverageItem).balanceOf(strategy),
            leverageItem
        ));
        return leverageAmount;
    }

    function _deleverageForWithdraw(
      address strategy, 
      int256[] memory estimates, 
      uint256 total, 
      uint256 expectedWeth, 
      uint256 itemsLength, 
      BinaryTreeWithPayload.Tree memory mm
    ) private {
        address[] memory strategyDebt = IStrategy(strategy).debt();
        uint256 expectedDebt;
        {
            // Add up debt estimates
            uint256 estimatedDebtBefore;
            for (uint256 i; i < strategyDebt.length; ++i) {
                estimatedDebtBefore = estimatedDebtBefore.add(uint256(-estimates[itemsLength + i]));
            }
            // Note: Loss of precision by using 'debtPercentage' as a intermediary is an advantage here
            // because it rounds the 'estimatedDebtAfter' down to the nearest tenth of a percent
            uint256 debtPercentage = estimatedDebtBefore.mul(DIVISOR).div(total.add(expectedWeth)); // total before = total + expected weth
            uint256 estimatedDebtAfter = total.mul(debtPercentage).div(DIVISOR);
            expectedDebt = estimatedDebtBefore.sub(estimatedDebtAfter);
        }

        if (expectedDebt == 0 || strategyDebt.length == 0) return;
        uint256 i;
        int256 estimatedValue;
        int256 expectedValue;
        uint256 diff;
        while (expectedDebt > 0 && i < strategyDebt.length) {
            estimatedValue = estimates[itemsLength + i];
            expectedValue = StrategyLibrary.getExpectedTokenValue(total, strategy, strategyDebt[i]);
            if (estimatedValue < expectedValue) {
                diff = uint256(-estimatedValue.sub(expectedValue));
                if (diff > expectedDebt) {
                    diff = expectedDebt;
                    expectedDebt = 0;
                } else {
                    expectedDebt = expectedDebt-diff;  // since expectedDebt >= diff
                }
                _repayPath(
                    IStrategy(strategy).getTradeData(strategyDebt[i]),
                    diff,
                    total,
                    strategy,
                    mm
                );
            }
            ++i;
        }
    }

    function _getSortedDiffs(
        address strategy,
        address[] memory strategyItems,
        int256[] memory estimates,
        uint256 total,
        BinaryTreeWithPayload.Tree memory mm
    ) private view returns(
        uint256[] memory diffs,
        bytes[] memory payloads
    ) {
        BinaryTreeWithPayload.Tree memory tree = BinaryTreeWithPayload.newNode();

        address strategyItem;
        int256 expectedValue;
        int256 estimatedValue;
        uint256 numberAdded;
        for (uint256 i; i < strategyItems.length; ++i) {
            strategyItem = strategyItems[i];
            expectedValue = StrategyLibrary.getExpectedTokenValue(
                total,
                strategy,
                strategyItem
            );
            estimatedValue = estimates[i];
            if (_getTempEstimate(mm, strategy, strategyItem) > 0) {
                estimatedValue = _getTempEstimate(mm, strategy, strategyItem);
                _removeTempEstimate(mm, strategy, strategyItem);
            }
            if (estimatedValue > expectedValue) {
                // condition check above means adding diff that isn't overflowed
                tree.add(uint256(estimatedValue-expectedValue), abi.encode(strategyItem, estimatedValue));
                ++numberAdded;
            }
        }
        diffs = new uint256[](numberAdded+1); // +1 is for length entry. see `BinaryTreeWithPayload.readInto`
        payloads = new bytes[](numberAdded);
        tree.readInto(diffs, payloads);
    }

    function _startTempEstimateSession() private pure returns(BinaryTreeWithPayload.Tree memory) {
        return BinaryTreeWithPayload.newNode();
    }

    function _setTempEstimate(BinaryTreeWithPayload.Tree memory mm, address strategy, address item, int256 value) private pure {
        mm.add(keccak256(abi.encode(strategy, item)), bytes32(value));
    }

    function _getTempEstimate(BinaryTreeWithPayload.Tree memory mm, address strategy, address item) private pure returns(int256) {
        (bool ok, bytes memory result) = mm.getValue(keccak256(abi.encode(strategy, item)));
        if (ok) {
            return abi.decode(result, (int256));    
        }
        return 0;
    }

    function _removeTempEstimate(BinaryTreeWithPayload.Tree memory mm, address strategy, address item) private pure {
        mm.add(keccak256(abi.encode(strategy, item)), bytes32(0));
    }
}
