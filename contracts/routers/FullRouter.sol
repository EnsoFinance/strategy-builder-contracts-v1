//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "../interfaces/IExchangeAdapter.sol";
import "../interfaces/IStrategy.sol";
import "../libraries/StrategyLibrary.sol";
import "./StrategyRouter.sol";

contract FullRouter is StrategyTypes, StrategyRouter {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    address public susd;
    mapping(address => int256) private _tempEstimate;

    constructor(address controller_) public StrategyRouter(RouterCategory.LOOP, controller_) {
        susd = controller.oracle().susd();
    }

    function deposit(address strategy, bytes calldata data)
        external
        override
        onlyStrategy(strategy)
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
        onlyStrategy(strategy)
    {
        (uint256 percentage) =
            abi.decode(data, (uint256));
        address[] memory strategyDebt = IStrategy(strategy).debt();
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            address strategyItem = strategyDebt[i];
            uint256 balance = IERC20(strategyItem).balanceOf(strategy);
            int256 estimatedValue =
                controller.oracle().estimateItem(
                    balance,
                    strategyItem
                );
            _deleveragePath(
                IStrategy(strategy).getTradeData(strategyItem),
                uint256(-estimatedValue).mul(percentage).div(10**18),
                estimatedValue,
                strategy
            );
        }
        address[] memory strategyItems = IStrategy(strategy).items();
        for (uint256 i = 0; i < strategyItems.length; i++) {
            address strategyItem = strategyItems[i];
            uint256 balance = IERC20(strategyItem).balanceOf(strategy);
            TradeData memory tradeData = IStrategy(strategy).getTradeData(strategyItem);
            if (tradeData.cache.length > 0) {
                //Apply multiplier
                uint16 multiplier = abi.decode(tradeData.cache, (uint16));
                balance = balance.mul(multiplier).div(DIVISOR);
            }
            _sellPath(
                tradeData,
                balance.mul(percentage).div(10**18),
                strategyItem,
                strategy
            );
        }
    }

    function rebalance(address strategy, bytes calldata data) external override onlyController {
        (uint256 total, int256[] memory estimates) = abi.decode(data, (uint256, int256[]));
        address[] memory strategyItems = IStrategy(strategy).items();
        address[] memory strategyDebt = IStrategy(strategy).debt();

        // Deleverage debt
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            _repayToken(
                strategy,
                strategyDebt[i],
                estimates[strategyItems.length + i],
                StrategyLibrary.getExpectedTokenValue(total, strategy, strategyDebt[i])
            );
        }
        uint256[] memory buy = new uint256[](strategyItems.length);
        // Sell loop
        for (uint256 i = 0; i < strategyItems.length; i++) {
            address strategyItem = strategyItems[i];
            int256 estimate = estimates[i];
            if (_tempEstimate[strategyItem] > 0) {
                estimate = _tempEstimate[strategyItem];
                delete _tempEstimate[strategyItem];
            }
            if (strategyItem != weth) {
                int256 expected = StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItem);
                if (!_sellToken(
                        strategy,
                        strategyItem,
                        estimate,
                        expected
                    )
                ) buy[i] = 1;
            }
        }
        // Buy loop
        for (uint256 i = 0; i < strategyItems.length; i++) {
            if (buy[i] == 1) {
                address strategyItem = strategyItems[i];
                int256 expected = StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItem);
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
                estimates[strategyItems.length + i],
                StrategyLibrary.getExpectedTokenValue(total, strategy, strategyDebt[i])
            );
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
                _deleveragePath(
                    IStrategy(strategy).getTradeData(strategyDebt[i]),
                    uint256(-estimate),
                    estimate,
                    strategy
                );
            } else {
                //Only repay if above rebalance threshold
                _repayToken(
                    strategy,
                    strategyDebt[i],
                    estimate,
                    StrategyLibrary.getExpectedTokenValue(total, strategy, strategyDebt[i])
                );
            }
        }
        for (uint256 i = 0; i < strategyItems.length; i++) {
            // Convert funds into Ether
            address strategyItem = strategyItems[i];
            if (strategyItem != weth) {
                int256 estimate = estimates[i];
                if (_tempEstimate[strategyItem] > 0) {
                    estimate = _tempEstimate[strategyItem];
                    delete _tempEstimate[strategyItem];
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
            _buyToken(
                strategy,
                from,
                susd,
                estimates[estimates.length - 1],
                StrategyLibrary.getExpectedTokenValue(total, strategy, address(-1))
            );
            _batchBuySynths(strategy, total);
        }
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            _borrowToken(
                strategy,
                strategyDebt[i],
                estimates[strategyItems.length + i],
                StrategyLibrary.getExpectedTokenValue(total, strategy, strategyDebt[i])
            );
        }
        int256 percentage = IStrategy(strategy).getPercentage(weth);
        if (percentage > 0) {
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

    function _batchBuySynths(address strategy, uint256 total) internal {
        // Use SUSD to purchase other synths
        uint256 susdWethPrice = controller.oracle().chainlinkOracle().consult(10**18, susd);
        address[] memory synths = IStrategy(strategy).synths();
        for (uint256 i = 0; i < synths.length; i++) {
            uint256 amount =
                uint256(StrategyLibrary.getExpectedTokenValue(total, strategy, synths[i]))
                               .mul(10**18)
                               .div(susdWethPrice);
            require(
                _delegateSwap(
                    IStrategy(strategy).getTradeData(synths[i]).adapters[0], // Assuming that synth only stores single SythetixAdapter
                    amount,
                    1,
                    susd,
                    synths[i],
                    strategy,
                    strategy
                ),
                "Swap failed"
            );
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
                IStrategyController(msg.sender).rebalanceThreshold(strategy)
            );
        if (estimatedValue > expectedValue.add(rebalanceRange)) {
            TradeData memory tradeData = IStrategy(strategy).getTradeData(token);
            _sellPath(
                tradeData,
                _pathPrice(tradeData, uint256(estimatedValue.sub(expectedValue)), token),
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
                    IStrategyController(controller).rebalanceThreshold(strategy)
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
        int256 estimatedValue,
        int256 expectedValue
    ) internal returns (bool) {
        int256 rebalanceRange =
            StrategyLibrary.getRange(
                expectedValue,
                IStrategyController(msg.sender).rebalanceThreshold(strategy)
            );
        if (estimatedValue < expectedValue.add(rebalanceRange)) {
            TradeData memory tradeData = IStrategy(strategy).getTradeData(token);
            _deleveragePath(
                tradeData,
                uint256(-estimatedValue.sub(expectedValue)),
                estimatedValue,
                strategy
            );

            return true;
        }
        return false;
    }

    function _borrowToken(
        address strategy,
        address token,
        int256 estimatedValue,
        int256 expectedValue
    ) internal {
        int256 amountInWeth;
        if (estimatedValue == 0) {
            amountInWeth = expectedValue;
        } else {
            int256 rebalanceRange =
                StrategyLibrary.getRange(
                    expectedValue,
                    IStrategyController(controller).rebalanceThreshold(strategy)
                );
            if (estimatedValue > expectedValue.sub(rebalanceRange)) {
                amountInWeth = expectedValue.sub(estimatedValue);
            }
        }
        if (amountInWeth < 0) {
            TradeData memory tradeData = IStrategy(strategy).getTradeData(token);
            _leveragePath(
                tradeData,
                uint256(-amountInWeth),
                estimatedValue,
                strategy
            );
        }
    }

    function _deleveragePath(
        TradeData memory data,
        uint256 amount,
        int256 estimatedDebt,
        address strategy
    ) internal {
        (address collateral) = abi.decode(data.cache, (address));
        uint256 balance;
        uint256 availableFunds;
        {
            balance = IERC20(collateral).balanceOf(strategy);
            uint256 estimatedCollateral = uint256(controller.oracle().estimateItem(balance, collateral));
            uint256 reserveBalance = uint256(-estimatedDebt).mul(balance).div(estimatedCollateral);
            availableFunds = balance.sub(reserveBalance).mul(9).div(10); //Provide 10% margin of error
            amount = amount.mul(balance).div(estimatedCollateral);
        }
        while (amount > 0) {
            for (int256 i = int256(data.adapters.length-1); i >= 0; i--) { //this doesn't work with uint256?? wtf solidity
                uint256 _amount;
                address _tokenIn;
                address _tokenOut;
                address _from;
                address _to;
                if (uint256(i) == data.adapters.length-1) {
                    _tokenIn = collateral;
                    _amount = availableFunds > amount ? amount : availableFunds;
                    _from = strategy;
                    //Update amounts
                    amount = amount.sub(_amount);
                } else {
                    _tokenIn = data.path[uint256(i)];
                    if (_tokenIn == collateral) { // in case of leverage
                      _from = strategy;
                      _amount = availableFunds > amount ? amount : availableFunds;
                      //Update amounts
                      amount = amount.sub(_amount);
                      balance = IERC20(collateral).balanceOf(strategy);
                    } else {
                      _from = address(this);
                      _amount = IERC20(_tokenIn).balanceOf(_from);
                    }

                }
                if (_amount > 0) {
                    if (uint256(i) == 0) {
                        _tokenOut = collateral;
                        _to = strategy;
                    } else {
                        _tokenOut = data.path[uint256(i-1)];
                        if (_tokenOut == collateral) { // in case of multiple repays in a trade path
                          _to = strategy;
                        } else {
                          _to = address(this);
                        }
                    }
                    require(
                        _delegateSwap(
                            data.adapters[uint256(i)],
                            _amount,
                            1,
                            _tokenIn,
                            _tokenOut,
                            _from,
                            _to
                        ),
                        "Swap failed"
                    );
                }
            }
            balance = IERC20(collateral).balanceOf(strategy);
        }
        _tempEstimate[collateral] = controller.oracle().estimateItem(balance, collateral);
    }

    function _leveragePath(
        TradeData memory data,
        uint256 amount,
        int256 estimatedDebt,
        address strategy
    ) internal {
        (address collateral) = abi.decode(data.cache, (address));
        uint256 balance;
        uint256 availableFunds;
        {
            balance = IERC20(collateral).balanceOf(strategy);
            uint256 estimatedCollateral = uint256(controller.oracle().estimateItem(balance, collateral));
            uint256 reserveBalance = uint256(-estimatedDebt).mul(balance).div(estimatedCollateral);
            availableFunds = balance.sub(reserveBalance).mul(750).div(DIVISOR);
            amount = amount.mul(balance).div(estimatedCollateral);
        }
        while (amount > 0) {
            for (uint256 i = 0; i < data.adapters.length; i++) {
                uint256 _amount;
                address _tokenIn;
                address _tokenOut;
                address _from;
                address _to;
                if (i == 0) {
                    _tokenIn = collateral;
                    _amount = availableFunds > amount ? amount : availableFunds;
                    _from = strategy;
                    //Update amounts
                    amount = amount.sub(_amount);
                } else {
                    _tokenIn = data.path[i-1];
                    if (_tokenIn == collateral) { // in case of multiple borrows in a trade path
                      _from = strategy;
                      _amount = availableFunds > amount ? amount : availableFunds;
                      //Update amounts
                      amount = amount.sub(_amount);
                      uint256 newBalance = IERC20(collateral).balanceOf(strategy);
                      availableFunds = newBalance.sub(balance).mul(750).div(DIVISOR);
                    } else {
                      _from = address(this);
                      _amount = IERC20(_tokenIn).balanceOf(_from);
                    }
                }
                if (_amount > 0) {
                    if (i == data.adapters.length-1) {
                        _tokenOut = collateral;
                        _to = strategy;
                    } else {
                        _tokenOut = data.path[i];
                        if (_tokenOut == collateral) { // in case of leverage
                          _to = strategy;
                        } else {
                          _to = address(this);
                        }
                    }
                    require(
                        _delegateSwap(
                            data.adapters[i],
                            _amount,
                            1,
                            _tokenIn,
                            _tokenOut,
                            _from,
                            _to
                        ),
                        "Swap failed"
                    );
                }

            }
            uint256 newBalance = IERC20(collateral).balanceOf(strategy);
            availableFunds = newBalance.sub(balance).mul(750).div(DIVISOR);
        }
    }
}
