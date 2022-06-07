//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./helpers/StrategyTypes.sol";
import "./helpers/Timelocks.sol";

contract StrategyControllerStorage  is StrategyTypes, Timelocks {
    // ALERT: Do not reorder variables on upgrades! Append only
    address internal _whitelist;
    address internal _oracle;
    address internal _weth;
    address internal _susd;
    mapping(address => uint256) internal _initialized;
    mapping(address => StrategyState) internal _strategyStates;
    mapping(address => Timelock) internal _timelocks;

    // Gap for future storage changes
    uint256[49] private __gap;
}
