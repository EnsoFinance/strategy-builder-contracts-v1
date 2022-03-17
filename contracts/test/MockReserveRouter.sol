//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../libraries/StrategyLibrary.sol";
import "../routers/StrategyRouter.sol";
import "./MockProtocol.sol";

contract MockReserveRouter is StrategyTypes, StrategyRouter {

    MockProtocol public immutable mockProtocol;

    constructor(address controller_) public StrategyRouter(RouterCategory.LOOP, controller_) {
      mockProtocol = new MockProtocol(weth);
    }

    function deposit(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        (address depositor, uint256 amount) =
            abi.decode(data, (address, uint256));

        address reserve = IStrategy(strategy).reserve();
        if (reserve != address(0)) {
          amount = amount.div(2);
          IERC20(weth).safeTransferFrom(depositor, address(this), amount);
          IERC20(weth).safeApprove(address(mockProtocol), amount);
          mockProtocol.deposit(reserve, amount);
        }
        IERC20(weth).safeTransferFrom(depositor, strategy, amount);
    }

    function withdraw(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        (strategy, data);
        revert("Withdraw not supported");
    }

    function rebalance(address strategy, bytes calldata data) external override onlyController {
        (strategy, data);
        revert("Rebalance not supported");
    }

    function restructure(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        (strategy, data);
        revert("Restructure not supported");
    }
}
