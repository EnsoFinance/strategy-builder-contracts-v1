//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "../interfaces/IStrategyController.sol";
import "./StrategyRouter.sol";

contract LoopRouter is StrategyRouter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;


    IExchangeAdapter private adapter;

    constructor(
        address adapter_,
        address controller_,
        address weth_
    ) public StrategyRouter(controller_, weth_) {
        adapter = IExchangeAdapter(adapter_);
    }

    function deposit(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        (address[] memory strategyItems, address[] memory adapters) =
            abi.decode(data, (address[], address[]));
        buyTokens(strategy, strategyItems, adapters);
    }

    function rebalance(address strategy, bytes calldata data) external override onlyController {
        (uint256 total, uint256[] memory estimates) = abi.decode(data, (uint256, uint256[]));
        address[] memory strategyItems = IStrategy(strategy).items();

        address[] memory buyTokens = new address[](strategyItems.length);
        uint256[] memory buyEstimates = new uint256[](strategyItems.length);
        uint256 buyCount = 0;
        // Sell loop
        for (uint256 i = 0; i < strategyItems.length; i++) {
            address tokenAddress = strategyItems[i];
            if (tokenAddress != weth) {
                if (!_sellToken(strategy, tokenAddress, estimates[i], total)) {
                    buyTokens[buyCount] = strategyItems[i];
                    buyEstimates[buyCount] = estimates[i];
                    buyCount++;
                }
            }
        }
        bool wethInStrategy = IStrategy(strategy).percentage(weth) != 0;
        // Buy loop
        for (uint256 i = 0; i < buyCount; i++) {
            _buyToken(
                strategy,
                buyTokens[i],
                buyEstimates[i],
                total,
                i == buyCount - 1 && !wethInStrategy // If the last token use up remainder of WETH
            );
        }
    }

    function _sellToken(
        address strategy,
        address tokenAddress,
        uint256 estimatedValue,
        uint256 total
    ) internal returns (bool) {
        uint256 expectedValue =
            StrategyLibrary.getExpectedTokenValue(total, strategy, tokenAddress);
        uint256 rebalanceRange =
            StrategyLibrary.getRange(
                expectedValue,
                IStrategyController(msg.sender).rebalanceThreshold(strategy)
            );
        if (estimatedValue > expectedValue.add(rebalanceRange)) {
            uint256 diff =
                adapter.spotPrice(estimatedValue.sub(expectedValue), weth, tokenAddress);
            require(
                _delegateSwap(
                    address(adapter),
                    diff,
                    0,
                    tokenAddress,
                    weth,
                    strategy,
                    strategy,
                    new bytes(0)
                ),
                "Swap failed"
            );
            return true;
        }
        return false;
    }

    function _buyToken(
        address strategy,
        address tokenAddress,
        uint256 estimatedValue,
        uint256 total,
        bool lastToken
    ) internal {
        if (lastToken) {
            require(
                _delegateSwap(
                    address(adapter),
                    IERC20(weth).balanceOf(strategy),
                    0,
                    weth,
                    tokenAddress,
                    strategy,
                    strategy,
                    new bytes(0)
                ),
                "Swap failed"
            );
        } else {
            uint256 expectedValue =
                StrategyLibrary.getExpectedTokenValue(total, strategy, tokenAddress);
            uint256 rebalanceRange =
                StrategyLibrary.getRange(
                    expectedValue,
                    IStrategyController(msg.sender).rebalanceThreshold(strategy)
                );
            if (estimatedValue < expectedValue.sub(rebalanceRange)) {
                uint256 diff = expectedValue.sub(estimatedValue);
                require(
                    _delegateSwap(
                        address(adapter),
                        diff,
                        0,
                        weth,
                        tokenAddress,
                        strategy,
                        strategy,
                        new bytes(0)
                    ),
                    "Swap failed"
                );
            }
        }
    }
}
