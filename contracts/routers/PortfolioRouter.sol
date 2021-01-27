//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "../interfaces/IPortfolioRouter.sol";

abstract contract PortfolioRouter is IPortfolioRouter { //solhint-disable-line
    address public override weth;
    bytes internal _package;

    constructor(address weth_) public {
        weth = weth_;
    }

    function getPackage() external view override returns (bytes memory) {
        return _package;
    }

    // Abstract external functions to be defined by inheritor
    function spotPrice(uint256 amount, address tokenIn, address tokenOut)
        external view override virtual returns (uint256);

    function swapPrice(uint256 amount, address tokenIn, address tokenOut)
        external view override virtual returns (uint256);

    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to,
        bytes memory data,
        bytes memory package
    ) public payable override virtual returns (bool);
}
