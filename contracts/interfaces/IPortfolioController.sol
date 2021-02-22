//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "./IPortfolio.sol";
import "./IPortfolioRouter.sol";

interface IPortfolioController {
    function setupPortfolio(
        address manager_,
        address portfolio_,
        address[] memory adapters_,
        address[] memory tokens_,
        uint256[] memory percentages_,
        uint256 threshold_,
        uint256 slippage_,
        uint256 timelock_
    ) external payable;

    function rebalance(IPortfolio portfolio, IPortfolioRouter router, bytes memory data) external;

    function deposit(
        IPortfolio portfolio,
        IPortfolioRouter router,
        bytes memory data
    ) external payable;

    function withdrawAssets(IPortfolio portfolio, uint256 amount) external;

    function withdrawPerformanceFee(IPortfolio portfolio) external;

    function restructure(
        IPortfolio portfolio, address[] memory tokens, uint256[] memory percentages
    ) external;

    function finalizeStructure(
        address payable portfolio,
        address router,
        address[] memory sellAdapters,
        address[] memory buyAdapters
    ) external;

    function updateValue(IPortfolio portfolio, uint256 categoryIndex, uint256 newValue) external;

    function finalizeValue(address portfolio) external;

    function openPortfolio(IPortfolio portfolio, uint256 fee) external;

    function social(address portfolio) external view returns (bool);

    function rebalanceThreshold(address portfolio) external view returns (uint256);

    function slippage(address portfolio) external view returns (uint256);

    function timelock(address portfolio) external view returns (uint256);
}
