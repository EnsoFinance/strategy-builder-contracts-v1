//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "../interfaces/IBaseAdapter.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/aave/ILendingPool.sol";
import "../interfaces/aave/ILendingPoolAddressesProvider.sol";
import "../libraries/StrategyLibrary.sol";
import "./StrategyRouter.sol";

struct LeverageItem {
  address token;
  uint16 percentage;
}

contract FullRouter is StrategyTypes, StrategyRouter {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    ILendingPoolAddressesProvider public immutable addressesProvider;
    address public immutable susd;
    mapping(int256 => mapping(address => mapping(address => int256))) private _tempEstimate;

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
          strategyDebt
        );
    }

    function withdraw(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        _startTempEstimateSession(strategy);
        (uint256 percentage, uint256 total, int256[] memory estimates) =
            abi.decode(data, (uint256, uint256, int256[]));

        uint256 expectedWeth = total.mul(percentage).div(10**18);
        total = total.sub(expectedWeth);

        address[] memory strategyItems = IStrategy(strategy).items();
        // Deleverage debt
        _deleverageForWithdraw(strategy, strategyItems, estimates, total);
        // Sell loop
        for (uint256 i = 0; i < strategyItems.length; i++) {
            int256 estimatedValue = estimates[i];
            if (_getTempEstimate(strategy, strategyItems[i]) > 0) {
                estimatedValue = _getTempEstimate(strategy, strategyItems[i]);
                _removeTempEstimate(strategy, strategyItems[i]);
            }
            int256 expectedValue = StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItems[i]);
            if (estimatedValue > expectedValue) {
                _sellPath(
                    IStrategy(strategy).getTradeData(strategyItems[i]),
                    _estimateSellAmount(strategy, strategyItems[i], uint256(estimatedValue.sub(expectedValue)), uint256(estimatedValue)),
                    strategyItems[i],
                    strategy
                );
            }
        }
    }

    function rebalance(address strategy, bytes calldata data) external override onlyController {
        _startTempEstimateSession(strategy);
        //_startTempEstimateSession(strategy);
        (uint256 total, int256[] memory estimates) = abi.decode(data, (uint256, int256[]));
        address[] memory strategyItems = IStrategy(strategy).items();
        address[] memory strategyDebt = IStrategy(strategy).debt();
        // Deleverage debt
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            _repayToken(
                strategy,
                strategyDebt[i],
                total,
                estimates[strategyItems.length + i]
            );
        }
        // Sell loop
        int256[] memory buy = new int256[](strategyItems.length);
        for (uint256 i = 0; i < strategyItems.length; i++) {
            address strategyItem = strategyItems[i];
            int256 estimate = estimates[i];
            if (_getTempEstimate(strategy, strategyItem) > 0) {
                estimate = _getTempEstimate(strategy, strategyItem);
                _removeTempEstimate(strategy, strategyItem);
            }
            int256 expected = StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItem);
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
        for (uint256 i = 0; i < strategyItems.length; i++) {
            if (buy[i] != 0) {
                address strategyItem = strategyItems[i];
                int256 expected = buy[i];
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
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            _borrowToken(
                strategy,
                strategyDebt[i],
                total,
                estimates[strategyItems.length + i]
            );
        }
    }

    function restructure(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        _startTempEstimateSession(strategy);
        (
          uint256 currentTotal,
          int256[] memory currentEstimates,
          address[] memory currentItems,
          address[] memory currentDebt
        ) = abi.decode(data, (uint256, int256[], address[], address[]));

        _batchSell(strategy, currentTotal, currentEstimates, currentItems, currentDebt);
        (uint256 newTotal, int256[] memory newEstimates) = IOracle(IStrategy(strategy).oracle()).estimateStrategy(IStrategy(strategy));
        address[] memory newItems = IStrategy(strategy).items();
        address[] memory newDebt = IStrategy(strategy).debt();
        _batchBuy(strategy, strategy, newTotal, newEstimates, newItems, newDebt);
    }

    function _batchSell(
        address strategy,
        uint256 total,
        int256[] memory estimates,
        address[] memory strategyItems,
        address[] memory strategyDebt
    ) internal {
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            int256 estimate = estimates[strategyItems.length + i];
            //Repay all debt that has 0 percentage
            if (IStrategy(strategy).getPercentage(strategyDebt[i]) == 0) {
                _repayPath(
                    IStrategy(strategy).getTradeData(strategyDebt[i]),
                    uint256(-estimate),
                    total,
                    strategy
                );
            } else {
                //Only repay if above rebalance threshold
                _repayToken(
                    strategy,
                    strategyDebt[i],
                    total,
                    estimate
                );
            }
        }
        for (uint256 i = 0; i < strategyItems.length; i++) {
            // Convert funds into Ether
            address strategyItem = strategyItems[i];
            int256 estimate = estimates[i];
            if (_getTempEstimate(strategy, strategyItem) > 0) {
                estimate = _getTempEstimate(strategy, strategyItem);
                _removeTempEstimate(strategy, strategyItem);
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
        address[] memory strategyDebt
    ) internal {
        for (uint256 i = 0; i < strategyItems.length; i++) {
            address strategyItem = strategyItems[i];
            _buyToken(
                strategy,
                from,
                strategyItem,
                estimates[i],
                StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItem)
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
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            _borrowToken(
                strategy,
                strategyDebt[i],
                total,
                estimates[strategyItems.length + i]
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
        for (uint256 i = 0; i < synths.length; i++) {
            uint256 percentage = uint256(IStrategy(strategy).getPercentage(synths[i]));
            if (percentage != 0) {
                uint256 amount = susdBalance.mul(percentage).div(virtualPercentage);
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
        int256 estimatedValue
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
            strategy
        );
    }

    function _borrowToken(
        address strategy,
        address token,
        uint256 total,
        int256 estimatedValue
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
            TradeData memory tradeData = IStrategy(strategy).getTradeData(token);
            _borrowPath(
                tradeData,
                uint256(-amountInWeth),
                total,
                strategy,
                isDeposit
            );
        }
    }

    function _repayPath(
        TradeData memory data,
        uint256 amount, // weth
        uint256 total,
        address strategy
    ) internal {
        if (amount == 0 && (data.path[data.path.length-1] != weth || data.cache.length == 0)) return; // Debt doesn't need to change and no leverage tokens to deleverage so return
        // Debt trade paths should have path.length == adapters.length,
        // since final token can differ from the debt token defined in the strategy
        require(data.adapters.length == data.path.length, "Incorrect trade data");
        ILendingPool lendingPool = ILendingPool(addressesProvider.getLendingPool());
        IOracle oracle = controller.oracle();
        LeverageItem[] memory leverageItems;
        uint256[] memory leverageLiquidity;

        if (data.path[data.path.length-1] != weth) {
            // Convert amount into the first token's currency
            amount = amount.mul(10**18).div(uint256(oracle.estimateItem(10**18, data.path[data.path.length-1])));
        } else if (data.cache.length > 0) {
            // Deleverage tokens
            leverageItems = abi.decode(data.cache, (LeverageItem[]));
            leverageLiquidity = new uint256[](leverageItems.length);
            if (amount == 0) {
                // Special case where debt doesn't need to change but the relative amounts of leverage tokens do. We must first deleverage our debt
                for (uint256 i = 0; i < leverageItems.length; i++) {
                    leverageLiquidity[i] = _getLeverageRemaining(oracle, strategy, leverageItems[i].token, total, false);
                    amount = amount.add(leverageLiquidity[i]);
                }
            } else {
                uint256 leverageAmount = amount; // amount is denominated in weth here
                for (uint256 i = 0; i < leverageItems.length; i++) {
                    address token = leverageItems[i].token;
                    if (leverageItems.length > 1) { //If multiple leveraged items, some may have less liquidity than the total amount we need to sell
                        uint256 liquidity = _getLeverageRemaining(oracle, strategy, token, total, false);
                        leverageLiquidity[i] = leverageAmount > liquidity ? liquidity : leverageAmount;
                    } else {
                        leverageLiquidity[i] = leverageAmount;
                        _setTempEstimate(strategy, token, oracle.estimateItem(
                          IERC20(token).balanceOf(strategy),
                          token
                        ));
                    }
                    leverageAmount = leverageAmount.sub(leverageLiquidity[i]);
                }
                assert(leverageAmount == 0);
            }
        }

        while (amount > 0) {
            if (leverageItems.length > 0) {
                // Leverage tokens: cache can contain an array of tokens that can be purchased with the WETH received from selling debt
                ( , , uint256 availableBorrowsETH, , , ) = lendingPool.getUserAccountData(strategy);
                bool isLiquidityRemaining = false;
                for (uint256 i = 0; i < leverageItems.length; i++) {
                    if (leverageLiquidity[i] > 0 && availableBorrowsETH > 0) {
                        // Only deleverage token when there is a disparity between the expected value and the estimated value
                        uint256 leverageAmount = _deleverage(oracle, strategy, leverageItems[i].token, leverageLiquidity[i], availableBorrowsETH);
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
            for (int256 i = int256(data.adapters.length-1); i >= 0; i--) { //this doesn't work with uint256?? wtf solidity
                uint256 _amount;
                address _tokenIn = data.path[uint256(i)];
                address _tokenOut;
                address _from;
                address _to;

                if (uint256(i) == data.adapters.length-1) {
                    uint256 balance = IERC20(_tokenIn).balanceOf(strategy);
                    _amount = balance > amount ? amount : balance;
                    _from = strategy;
                    //Update amounts
                    amount = amount.sub(_amount);
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
        }
    }

    function _borrowPath(
        TradeData memory data,
        uint256 amount, // weth
        uint256 total,
        address strategy,
        bool isDeposit
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
              for (uint256 i = 0; i < leverageItems.length; i++) {
                  leverageLiquidity[i] = _getLeveragePercentage(strategy, leverageItems[i].token, leverageItems[i].percentage, total);
              }
            } else {
              IOracle oracle = controller.oracle();
              for (uint256 i = 0; i < leverageItems.length; i++) {
                  leverageLiquidity[i] = _getLeverageRemaining(oracle, strategy, leverageItems[i].token, total, true);
              }
            }
        }

        while (amount > 0) { //First loop must either borrow the entire amount or add more tokens as collateral in order to borrow more on following loops
            ( , , uint256 availableBorrowsETH, , , ) = lendingPool.getUserAccountData(strategy);
            for (uint256 i = 0; i < data.adapters.length; i++) {
                uint256 _amount;
                address _tokenIn;
                address _tokenOut = data.path[i];
                address _from;
                address _to;
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
                    if (i == data.adapters.length-1 && leverageItems.length == 0) {
                        _to = strategy;
                    } else {
                        _to = address(this);
                    }
                    _delegateSwap(
                        data.adapters[i],
                        _amount,
                        1,
                        _tokenIn,
                        _tokenOut,
                        _from,
                        _to
                    );
                }
            }

            if (leverageItems.length > 0) {
                // Leverage tokens: cache can contain an array of tokens that can be purchased with the WETH received from selling debt
                // Only purchase token when there is a disparity between the expected value and the estimated value
                for (uint256 i = 0; i < leverageItems.length; i++) {
                    // Since we're inside a while loop, the last item will be when `amount` == 0
                    bool lastItem = amount == 0 && i == leverageItems.length - 1;
                    if (leverageLiquidity[i] > 0 || lastItem) {
                        uint256 leverageAmount = _leverage(strategy, leverageItems[i].token, leverageLiquidity[i], lastItem);
                        if (leverageAmount > leverageLiquidity[i]) {
                            // Sometimes we may pay more than needed such as when we reach the lastItem
                            // and we use the remaining weth (rather than leave it in this contract) so
                            // just set to zero
                            leverageLiquidity[i] = 0;
                        } else {
                            // If leverageLiqudity remains, it means there wasn't enough weth to reach
                            // the expected amount, the remained will be handled on subsequent loops of
                            // the parent while loop
                            leverageLiquidity[i] = leverageLiquidity[i].sub(leverageAmount);
                        }
                    }
                }
            }
        }
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
        bool isLeveraging
    ) internal returns (uint256) {
        int256 expected = StrategyLibrary.getExpectedTokenValue(total, strategy, leverageItem);
        int256 estimate = oracle.estimateItem(
            IERC20(leverageItem).balanceOf(strategy),
            leverageItem
        );
        if (isLeveraging) {
            if (expected > estimate) return uint256(expected.sub(estimate));
        } else {
            _setTempEstimate(strategy, leverageItem, estimate); // Store this value for _deleverage()
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
        uint256 available
    ) internal returns (uint256) {
        uint256 leverageAmount = leverageLiquidity > available ? available : leverageLiquidity;
        uint256 leverageEstimate = uint256(_getTempEstimate(strategy, leverageItem)); //Set in _getLeverageRemaining
        require(leverageEstimate > 0, "Insufficient collateral");
        _sellPath(
            IStrategy(strategy).getTradeData(leverageItem),
            _estimateSellAmount(strategy, leverageItem, leverageAmount, leverageEstimate),
            leverageItem,
            strategy
        );
        // Update temp estimates with new value since tokens have been sold (it will be needed on later sell loops)
        _setTempEstimate(strategy, leverageItem, oracle.estimateItem(
            IERC20(leverageItem).balanceOf(strategy),
            leverageItem
        ));
        return leverageAmount;
    }

    function _deleverageForWithdraw(address strategy, address[] memory strategyItems, int256[] memory estimates, uint256 total) private {
        address[] memory strategyDebt = IStrategy(strategy).debt();
        // Deleverage debt
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            int256 estimatedValue = estimates[strategyItems.length + i];
            int256 expectedValue = StrategyLibrary.getExpectedTokenValue(total, strategy, strategyDebt[i]);
            if (estimatedValue < expectedValue) {
                _repayPath(
                    IStrategy(strategy).getTradeData(strategyDebt[i]),
                    uint256(-estimatedValue.sub(expectedValue)),
                    total,
                    strategy
                );
            }
        }
    }

    function _startTempEstimateSession(address strategy) private {
        /*
          To ensure that a stale "temp" estimate isn't leaked into other function calls
          by not being "delete"d in the same external call in which it is set, we
          associate to each external call a "session counter" so that it only deals with
          temp values corresponding to its own session.
        **/

        ++_tempEstimate[0][strategy][address(0)]; // ++counter
    }

    function _getCurrentTempEstimateSession(address strategy) private view returns(int256) {
        return _tempEstimate[0][strategy][address(0)]; // counter
    }

    function _setTempEstimate(address strategy, address item, int256 value) private {
        int256 session = _getCurrentTempEstimateSession(strategy);
        _tempEstimate[session][strategy][item] = value;
    }

    function _getTempEstimate(address strategy, address item) private view returns(int256) {
        int256 session = _getCurrentTempEstimateSession(strategy);
        return _tempEstimate[session][strategy][item];
    }

    function _removeTempEstimate(address strategy, address item) private {
        int256 session = _getCurrentTempEstimateSession(strategy);
        delete _tempEstimate[session][strategy][item];
    }

}
