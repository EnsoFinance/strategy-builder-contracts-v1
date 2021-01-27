//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;


interface IPortfolioRouter {
    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to,
        bytes memory data,
        bytes memory package
    ) external payable returns (bool);

    function weth() external view returns (address);

    function getPackage() external view returns (bytes memory);

    function spotPrice(uint256 amount, address tokenIn, address tokenOut)
        external view returns (uint256);

    function swapPrice(uint256 amount, address tokenIn, address tokenOut)
        external view returns (uint256);
}
