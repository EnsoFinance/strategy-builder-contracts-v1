//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./IStrategy.sol";
import "./IStrategyRouter.sol";

interface IStrategyController {
    function setupStrategy(
        address manager_,
        address strategy_,
        bool social_,
        uint256 fee_,
        uint256 threshold_,
        uint256 slippage_,
        uint256 timelock_,
        address router_,
        bytes memory data_
    ) external payable;

    function rebalance(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external;

    function deposit(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external payable;

    function withdrawAssets(IStrategy strategy, uint256 amount) external;

    function withdrawPerformanceFee(IStrategy strategy) external;

    function restructure(
        IStrategy strategy,
        address[] memory tokens,
        uint256[] memory percentages
    ) external;

    function finalizeStructure(
        IStrategy strategy,
        address router,
        address[] memory sellAdapters,
        address[] memory buyAdapters
    ) external;

    function updateValue(
        IStrategy strategy,
        uint256 categoryIndex,
        uint256 newValue
    ) external;

    function finalizeValue(address strategy) external;

    function openStrategy(IStrategy strategy, uint256 fee) external;

    function social(address strategy) external view returns (bool);

    function rebalanceThreshold(address strategy) external view returns (uint256);

    function slippage(address strategy) external view returns (uint256);

    function timelock(address strategy) external view returns (uint256);
}
