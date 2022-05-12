//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../libraries/SafeERC20.sol";
import "../libraries/StrategyLibrary.sol";
import "./StrategyRouter.sol";

contract BatchDepositRouter is StrategyRouter {
    using SafeERC20 for IERC20;

    constructor(address controller_) public StrategyRouter(RouterCategory.BATCH, controller_) {}

    function deposit(address strategy, bytes calldata data)
        external
        override
        onlyController
    {
        require(IStrategy(strategy).debt().length == 0, "Cannot batch deposit debt");
        IOracle oracle = controller.oracle();
        (address depositor, uint256 amount) =
            abi.decode(data, (address, uint256));
        address[] memory strategyItems = IStrategy(strategy).items();
        for (uint256 i; i < strategyItems.length; i++) {
          address token = strategyItems[i];
          uint256 expectedValue =
              uint256(StrategyLibrary.getExpectedTokenValue(amount, strategy, token));
          if (expectedValue > 0)
              IERC20(token).safeTransferFrom(
                  depositor,
                  strategy,
                  expectedValue.mul(10**18).div(uint256(oracle.estimateItem(10**18, token)))
              );
        }
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
