//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../libraries/SafeERC20.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IStrategyRouter.sol";
import "../interfaces/IStrategyController.sol";
import "../helpers/Multicall.sol";

contract GenericWrapper is Multicall {
    using SafeERC20 for IERC20;
    IStrategyController public immutable controller;
    IStrategyRouter public immutable genericRouter;

    constructor(address controller_, address genericRouter_) public {
        controller = IStrategyController(controller_);
        genericRouter = IStrategyRouter(genericRouter_);
    }

    function singleTokenDeposit(IStrategy strategy, IERC20 token, uint256 amount) external {
        Call[] memory calls = new Call[](1);
        calls[0] = Call(
            address(token),
            abi.encodeWithSelector(
                token.transfer.selector,
                address(strategy),
                amount
            )
        );
        bytes memory data = abi.encode(calls);
        token.safeTransferFrom(msg.sender, address(genericRouter), amount);
        controller.deposit(strategy, genericRouter, 0, 0, data);
        strategy.transfer(msg.sender, strategy.balanceOf(address(this)));
    }
}
