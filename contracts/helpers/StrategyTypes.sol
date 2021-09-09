//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface StrategyTypes {

    enum ItemCategory {BASIC, SYNTH, DEBT, RESERVE}
    enum EstimatorCategory {BASIC, STRATEGY, SYNTH, COMPOUND, AAVE, AAVE_DEBT, YEARN_V1, YEARN_V2, CURVE, CURVE_GAUGE, BALANCER, UNISWAP_V2, UNISWAP_V3, SUSHI, SUSHI_FARM}
    enum TimelockCategory {RESTRUCTURE, THRESHOLD, SLIPPAGE, TIMELOCK, PERFORMANCE}

    struct StrategyItem {
        address item;
        int256 percentage;
        TradeData data;
    }

    struct TradeData {
        address[] adapters;
        address[] path;
        bytes cache;
    }

    struct StrategyState {
        uint32 timelock;
        uint16 rebalanceThreshold;
        uint16 slippage;
        uint16 performanceFee;
        bool social;
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
}
