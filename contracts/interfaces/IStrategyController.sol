//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./IStrategy.sol";
import "./IStrategyRouter.sol";
import "./IOracle.sol";
import "./IWhitelist.sol";
import "../helpers/StrategyTypes.sol";

interface IStrategyController is StrategyTypes {

    event NewStructure(address indexed strategy, StrategyItem[] items, bool indexed finalized);
    event NewValue(address indexed strategy, TimelockCategory category, uint256 newValue, bool indexed finalized);
    event UpdateTradeData(address indexed strategy, address indexed item, TradeData data, bool indexed finalized);
    event StrategyOpen(address indexed strategy);
    event StrategySet(address indexed strategy);
    event RebalanceParametersUpdated(uint256 indexed rebalanceTimelockPeriod, uint256 indexed rebalanceThreshold, bool indexed finalized);

    // hack! these events are called in the `ControllerLibrary`
    // but cannot be tracked unless they are defined here!
    event Balanced(address indexed strategy, uint256 totalBefore, uint256 totalAfter);
    event Deposit(address indexed strategy, address indexed account, uint256 value, uint256 amount);
    event Withdraw(address indexed strategy, address indexed account, uint256 value, uint256 amount);
    event Repositioned(address indexed strategy, address indexed adapter, address indexed token);

    function setupStrategy(
        address manager_,
        address strategy_,
        InitialState memory state_,
        address router_,
        bytes memory data_
    ) external payable;

    function deposit(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external payable;

    function withdrawETH(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external;

    function withdrawWETH(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external;

    function rebalance(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external;

    function claimAll(
        IStrategy strategy
    ) external;

    function repositionSynths(IStrategy strategy, address token) external;

    function restructure(
        IStrategy strategy,
        StrategyItem[] memory strategyItems
    ) external;

    function finalizeStructure(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external;

    function updateTradeData(
        IStrategy strategy,
        address item,
        TradeData calldata data
    ) external;

    function finalizeTradeData(
        IStrategy strategy
    ) external;

    function updateValue(
        IStrategy strategy,
        TimelockCategory category,
        uint256 newValue
    ) external;

    function finalizeValue(IStrategy strategy) external;

    function updateRebalanceParameters(uint256 rebalanceTimelockPeriod, uint256 rebalanceThresholdScalar_) external;

    function openStrategy(IStrategy strategy) external;

    function setStrategy(IStrategy strategy) external;

    function initialized(address strategy) external view returns (bool);

    function strategyState(address strategy) external view returns (StrategyState memory);

    function updateAddresses() external;

    function verifyStructure(address strategy, StrategyItem[] memory newItems) external view;

    function oracle() external view returns (IOracle);

    function whitelist() external view returns (IWhitelist);

    function weth() external view returns (address);

    function pool() external view returns (address);

    function rebalanceThresholdScalar() external view returns(uint256);
}
