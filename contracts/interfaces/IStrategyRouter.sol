//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "../interfaces/IStrategyController.sol";

interface IStrategyRouter {
    enum RouterCategory {GENERIC, LOOP, BATCH, OTHER}

    function rebalance(address strategy, bytes calldata data) external;

    function restructure(address strategy, bytes calldata data) external;

    function deposit(address strategy, bytes calldata data) external;

    function withdraw(address strategy, bytes calldata) external;

    function estimateWithdraw(address strategy, bytes calldata) external view returns(uint256[] memory balances, uint256 updatedStrategyWethBalance);

    function controller() external view returns (IStrategyController);

    function category() external view returns (RouterCategory);
}
