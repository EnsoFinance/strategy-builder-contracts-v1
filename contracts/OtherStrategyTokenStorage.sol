//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./helpers/StrategyTypes.sol";

contract OtherStrategyTokenStorage is StrategyTypes {
    bytes32 public DOMAIN_SEPARATOR;

    mapping(address => mapping(address => uint256)) internal _allowances;
    mapping(address => uint256) internal _balances;
    mapping(address => uint256) internal _nonces;
    uint256 internal _totalSupply;
    string internal _name;
    string internal _symbol;
    string internal _version;

    ItemCategory internal _locked;
    uint224 internal _streamingFeeRate;
    uint16 internal _performanceFee;
    uint16 internal _rebalanceThreshold;
    uint96 internal _lastStreamTimestamp;
    uint128 internal _lastTokenValue;
    mapping(address => uint256) internal _paidTokenValues;

    address internal _manager;
    address internal _pool;
    address internal _oracle;
    address internal _weth;
    address internal _susd;

    address internal _tempRouter;
    address[] internal _items;
    address[] internal _synths;
    address[] internal _debt;
    mapping(address => int256) internal _percentage;
    mapping(address => TradeData) internal _tradeData;
    mapping(bytes32 => TimelockData) internal __timelockData;

    uint256 internal _managementFee;
    uint256 internal _managementFeeRate;

    bytes[] internal _claimables;

    // Gap for future storage changes
    uint256[46] private __gap;
}
