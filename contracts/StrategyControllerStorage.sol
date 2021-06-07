//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

contract StrategyControllerStorage {
    // ALERT: Do not reorder variables on upgrades! Append only
    enum TimelockCategory {RESTRUCTURE, THRESHOLD, SLIPPAGE, TIMELOCK}

    struct StrategyState {
        uint256 lastTokenValue;
        uint32 timelock;
        uint16 rebalanceThreshold;
        uint16 slippage;
        uint16 performanceFee;
        bool social;
        bool initialized;
    }

    /**
        @notice A time lock requirement for changing the state of this Strategy
        @dev WARNING: Only one TimelockCategory can be pending at a time
    */
    struct Timelock {
        TimelockCategory category;
        uint256 timestamp;
        bytes data;
    }

    // Reentrancy guard
    uint256 internal _locked;
    address internal _factory;

    mapping(address => StrategyState) internal _strategyStates;
    mapping(address => Timelock) internal _timelocks;

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
