//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

contract PortfolioControllerStorage {
    // ALERT: Do not reorder variables on upgrades! Append only
    enum TimelockCategory {RESTRUCTURE, THRESHOLD, SLIPPAGE, TIMELOCK}

    struct PortfolioState {
        bool social;
        uint256 performanceFee;
        uint256 rebalanceThreshold;
        uint256 slippage;
        uint256 timelock;
    }

    struct Timelock {
        TimelockCategory category;
        uint256 timestamp;
        bytes data;
    }

    // Portfolio
    bool internal _locked;

    mapping(address => bool) internal _initialized;
    mapping(address => uint256) internal _lastTokenValues;
    mapping(address => PortfolioState) internal _portfolioStates;
    mapping(address => Timelock) internal _timelocks;

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
