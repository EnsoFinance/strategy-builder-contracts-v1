//SPDX-License-Identifier: GPL-3.0-or-laterz
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../libraries/StrategyLibrary.sol";
import "./StrategyRouter.sol";

contract BatchDepositRouter is StrategyRouter {
    using SafeERC20 for IERC20;

    constructor(address controller_) public StrategyRouter(RouterCategory.BATCH, controller_) {}

    function deposit(address strategy, bytes calldata data)
        external
        override
        onlyStrategy(strategy)
    {
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
                  _pathPrice(
                      IStrategy(strategy).getTradeData(token),
                      expectedValue,
                      token
                  )
              );
        }
    }

    function withdraw(address strategy, bytes calldata data)
        external
        override
        onlyStrategy(strategy)
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
