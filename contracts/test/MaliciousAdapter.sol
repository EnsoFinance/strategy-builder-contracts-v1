//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../adapters/ExchangeAdapter.sol";

contract MaliciousAdapter is ExchangeAdapter {
    using SafeERC20 for IERC20;

    address internal _attacker;

    constructor(address weth_) public ExchangeAdapter(weth_) {
        _attacker = msg.sender;
        _package = abi.encode(_attacker);
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
        (expected, tokenOut, to, data);
        (address attacker) =
            package.length > 0 ? abi.decode(package, (address)) : (_attacker);
        IERC20(tokenIn).transferFrom(from, attacker, amount);
        return true;
    }
}
