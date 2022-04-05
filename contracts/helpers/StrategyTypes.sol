//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface StrategyTypes {
    enum ItemCategory {BASIC, SYNTH, DEBT, RESERVE}

    enum EstimatorCategory {
      DEFAULT_ORACLE,
      CHAINLINK_ORACLE,
      STRATEGY,
      BLOCKED
    }

    enum TimelockCategory {
      RESTRUCTURE,
      THRESHOLD,
      REBALANCE_SLIPPAGE,
      RESTRUCTURE_SLIPPAGE,
      TIMELOCK,
      PERFORMANCE
    }

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

    struct InitialState {
        uint32 timelock;
        uint16 rebalanceThreshold;
        uint16 rebalanceSlippage;
        uint16 restructureSlippage;
        uint16 performanceFee;
        bool social;
        bool set;
    }

    struct StrategyState {
        uint32 timelock;
        uint16 rebalanceSlippage;
        uint16 restructureSlippage;
        bool social;
        bool set;
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
