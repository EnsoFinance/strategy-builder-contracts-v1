//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../libraries/SafeERC20.sol";
import "../../interfaces/IStrategy.sol";
import "../../interfaces/IStrategyController.sol";
import "../../interfaces/IStrategyRouter.sol";
import "../BaseAdapter.sol";


contract MetaStrategyAdapter is BaseAdapter {
    using SafeERC20 for IERC20;

    uint256 public constant DEFAULT_SLIPPAGE = 980; //98%
    IStrategyController public immutable controller;
    IStrategyRouter public immutable router;


    constructor(
        address controller_,
        address router_,
        address weth_
    ) public BaseAdapter(weth_) {
        controller = IStrategyController(controller_);
        router = IStrategyRouter(router_);
    }

    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
        require(tokenIn != tokenOut, "Tokens cannot match");
        require(tokenIn == weth || tokenOut == weth, "No WETH");

        if (from != address(this))
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);

        if (tokenIn == weth) {
            if(address(router) != address(this))
                IERC20(tokenIn).safeApprove(address(router), amount);
            //Assumes the use of LoopRouter when depositing tokens
            controller.deposit(IStrategy(tokenOut), router, amount, DEFAULT_SLIPPAGE, "0x");
            if(address(router) != address(this))
                IERC20(tokenIn).safeApprove(address(router), 0);
        }

        if (tokenOut == weth)
            controller.withdrawWETH(IStrategy(tokenIn), router, amount, DEFAULT_SLIPPAGE, "0x");

        uint256 received = IERC20(tokenOut).balanceOf(address(this));
        require(received >= expected, "Insufficient tokenOut amount");

        if (to != address(this))
          IERC20(tokenOut).safeTransfer(to, received);
    }
}
