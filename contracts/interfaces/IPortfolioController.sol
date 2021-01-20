//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;


interface IPortfolioController {
    //address public weth;
    //function deposit(address depositor, address[] memory tokens, address[] memory routers) external payable;
    //function withdraw(address withdrawer, uint256 amount) external;

    function sellTokens(address[] memory tokens, address[] memory routers) external;

    function buyTokens(address[] memory tokens, address[] memory routers) external payable;

    function rebalance(bytes calldata data) external;

    function weth() external view returns (address);
}
