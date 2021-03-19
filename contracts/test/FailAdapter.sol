//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../adapters/ExchangeAdapter.sol";
import "hardhat/console.sol";

contract FailAdapter is ExchangeAdapter {

    constructor(address weth_) public ExchangeAdapter(weth_) {
        _package = abi.encode(buyFail, sellFail, weth_);
    }

    bool public buyFail;
    bool public sellFail;

    function setBuyFail(bool fail) external {
        buyFail = fail;
        _package = abi.encode(buyFail, sellFail, weth);
    }

    function setSellFail(bool fail) external {
        sellFail = fail;
        _package = abi.encode(buyFail, sellFail, weth);
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        (tokenIn, tokenOut);
        return amount;
    }

    function swapPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        (tokenIn, tokenOut);
        return amount;
    }

    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to,
        bytes memory data,
        bytes memory package
    ) public override returns (bool) {
        (amount, expected, tokenIn, tokenOut, from, to, data);
        (bool buyFailState, bool sellFailState, address wethAddress) = package.length > 0
            ? abi.decode(package, (bool, bool, address))
            : (buyFail, sellFail, weth);
        if (buyFailState && tokenIn == wethAddress) revert("Fail");
        if (sellFailState && tokenOut == wethAddress) revert("Fail");
        return true;
    }
}
