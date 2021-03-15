//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

interface IStrategyRouter {
    //address public weth;
    //function deposit(address depositor, address[] memory tokens, address[] memory routers) external payable;
    //function withdraw(address withdrawer, uint256 amount) external;

    function sellTokens(
        address strategy,
        address[] memory tokens,
        address[] memory routers
    ) external;

    function buyTokens(
        address strategy,
        address[] memory tokens,
        address[] memory routers
    ) external;

    function rebalance(address strategy, bytes calldata data) external;

    function deposit(address strategy, bytes calldata data) external;

    function controller() external view returns (address);

    function weth() external view returns (address);
}
