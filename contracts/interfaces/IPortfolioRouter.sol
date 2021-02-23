//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

interface IPortfolioRouter {
    //address public weth;
    //function deposit(address depositor, address[] memory tokens, address[] memory routers) external payable;
    //function withdraw(address withdrawer, uint256 amount) external;

    function sellTokens(
        address portfolio,
        address[] memory tokens,
        address[] memory routers
    ) external;

    function buyTokens(
        address portfolio,
        address[] memory tokens,
        address[] memory routers
    ) external payable;

    function rebalance(address portfolio, bytes calldata data) external;

    function deposit(address portfolio, bytes calldata data) external payable;

    function controller() external view returns (address);

    function weth() external view returns (address);
}
