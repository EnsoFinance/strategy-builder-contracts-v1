//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

contract StrategyControllerStorage {
    // ALERT: Do not reorder variables on upgrades! Append only
    enum TimelockCategory {RESTRUCTURE, THRESHOLD, SLIPPAGE, TIMELOCK}

    struct StrategyState {
        bool social;
        uint256 performanceFee;
        uint256 rebalanceThreshold;
        uint256 slippage;
        uint256 timelock;
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
    bool internal _locked;

    mapping(address => bool) internal _initialized;
    mapping(address => uint256) internal _lastTokenValues;
    mapping(address => StrategyState) internal _strategyStates;
    mapping(address => Timelock) internal _timelocks;

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
