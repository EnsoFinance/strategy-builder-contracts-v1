//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./helpers/StrategyTypes.sol";

contract StrategyControllerStorage  is StrategyTypes {
    // ALERT: Do not reorder variables on upgrades! Append only
    address internal _factory;
    mapping(address => uint256) internal _initialized;
    mapping(address => StrategyState) internal _strategyStates;
    mapping(address => Timelock) internal _timelocks;
}
