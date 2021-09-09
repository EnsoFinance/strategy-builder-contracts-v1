//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IExchangeAdapter.sol";
import "../interfaces/IStrategy.sol";
import "../libraries/StrategyLibrary.sol";
import "./StrategyRouter.sol";

contract SynthRouter is StrategyTypes, StrategyRouter {
    using SafeMath for uint256;

    address public susd;

    constructor(address controller_) public StrategyRouter(RouterCategory.SYNTH, controller_) {
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
        int256[] memory estimates = new int256[](strategyItems.length + 1);
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
        onlyStrategy(strategy)
    {
      (strategy, data);
      revert("Withdraw not supported");
    }

    function rebalance(address strategy, bytes calldata data) external override onlyController {
        (uint256 total, int256[] memory estimates) = abi.decode(data, (uint256, int256[]));
        address[] memory strategyItems = IStrategy(strategy).items();

        uint256[] memory buy = new uint256[](strategyItems.length);
        // Sell loop
        for (uint256 i = 0; i < strategyItems.length; i++) {
            address strategyItem = strategyItems[i];
            if (strategyItem != weth) {
                if (!_sellToken(
                        strategy,
                        strategyItem == address(-1) ? susd : strategyItem,
                        estimates[i],
                        StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItem)
                    )
                ) buy[i] = 1;
            }
        }
        // Buy loop
        for (uint256 i = 0; i < strategyItems.length; i++) {
            if (buy[i] == 1) {
                address strategyItem = strategyItems[i];
                _buyToken(
                    strategy,
                    strategy,
                    strategyItem == address(-1) ? susd : strategyItem,
                    estimates[i],
                    StrategyLibrary.getExpectedTokenValue(total, strategy, strategyItem)
                );
            }
        }
        if (IStrategy(strategy).supportsSynths()) _batchBuySynths(strategy, total);
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
        (uint256 newTotal, int256[] memory newEstimates) = IOracle(IStrategy(strategy).oracle()).estimateStrategy(IStrategy(strategy));
        address[] memory newItems = IStrategy(strategy).items();
        _batchBuy(strategy, strategy, newTotal, newEstimates, newItems);
    }

    function _batchSell(
        address strategy,
        uint256 total,
        int256[] memory estimates,
        address[] memory strategyItems
    ) internal {
        for (uint256 i = 0; i < strategyItems.length; i++) {
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
        address[] memory strategyItems
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
}
