//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IPortfolioController.sol";

interface IPortfolio is IERC20 {
    function deposit(
        address[] memory routers,
        bytes calldata rebalanceData,
        IPortfolioController controller
    ) external payable;

    function withdraw(
        uint256 amount,
        bytes calldata rebalanceData,
        IPortfolioController controller
    ) external;

    function restructure(address[] memory tokens, uint256[] memory percentages) external;

    function finalizeStructure(
        address[] memory tokens,
        uint256[] memory percentages,
        address[] memory sellRouters,
        address[] memory buyRouters,
        IPortfolioController controller
    ) external;

    function rebalance(bytes calldata data, IPortfolioController controller) external;

    function openPortfolio() external;

    function updateRebalanceThreshold(uint256 threshold) external;

    function updateSlippage(uint256 slippage) external;

    function updateTimelock(uint256 timelock) external;

    function oracle() external view returns (address);

    function social() external view returns (bool);

    function rebalanceThreshold() external view returns (uint256);

    function slippage() external view returns (uint256);

    function timelock() external view returns (uint256);

    function getPortfolioTokens() external view returns (address[] memory);

    function getToken(uint256 index) external view returns (address);

    function getTokenPercentage(address tokenAddress) external view returns (uint256);
}
