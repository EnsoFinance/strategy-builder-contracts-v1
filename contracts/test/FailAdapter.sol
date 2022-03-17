//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../adapters/BaseAdapter.sol";
import "../interfaces/IRewardsAdapter.sol";

contract FailAdapterController {
    bool public buyFail;
    bool public sellFail;

    function setBuyFail(bool fail) external {
        buyFail = fail;
    }

    function setSellFail(bool fail) external {
        sellFail = fail;
    }
}

contract FailAdapter is BaseAdapter, IRewardsAdapter {
    FailAdapterController public immutable controller;

    constructor(address weth_) public BaseAdapter(weth_) {
        controller = new FailAdapterController();
    }

    function setBuyFail(bool fail) external {
        controller.setBuyFail(fail);
    }

    function setSellFail(bool fail) external {
        controller.setSellFail(fail);
    }

    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
        (amount, expected, tokenIn, tokenOut, from, to);

        if (controller.buyFail() && tokenIn == weth) revert("Fail");
        if (controller.sellFail() && tokenOut == weth) revert("Fail");
    }

    function claim(address token) public override {
        (token);
        revert();
    }
}
