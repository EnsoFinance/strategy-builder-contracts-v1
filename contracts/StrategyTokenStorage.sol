//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./interfaces/IStrategyToken.sol";
import "./helpers/StrategyTypes.sol";

contract StrategyTokenStorage is StrategyTypes {

    // debug
    // c means common
    // s means strategy
    // t means token
    // ? means unsure

    bytes32 public DOMAIN_SEPARATOR; // ?

    mapping(address => mapping(address => uint256)) internal _allowances; // t
    mapping(address => uint256) internal _balances; // t
    mapping(address => uint256) internal _nonces; // t
    uint256 internal _totalSupply; // t
    string internal _name; // c
    string internal _symbol; // c
    string internal _version; // c

    uint8 internal _locked; // c 
    uint224 internal _streamingFeeRate; // t
    uint16 internal _performanceFee; // t
    uint16 internal _rebalanceThreshold; // s
    uint96 internal _lastStreamTimestamp; // t
    uint128 internal _lastTokenValue; // !!! NEED to isolate to one t
    mapping(address => uint256) internal _paidTokenValues; // !!! NEED to isolate to one t

    address internal _manager; // c 
    address internal _pool; // c
    address internal _oracle; // c
    address internal _weth; // c
    address internal _susd; // s

    address internal _tempRouter; // s
    address[] internal _items; // s
    address[] internal _synths; // s
    address[] internal _debt; // s
    mapping(address => int256) internal _percentage; // s
    mapping(address => TradeData) internal _tradeData; // s
    mapping(bytes4 => TimelockData) internal __timelockData; // s

    uint256 internal _managementFee; // t
    uint256 internal _managementFeeRate; // t

    bytes[] internal _claimables; // s

    IStrategyToken internal _token; // s
    address internal _strategy; // t

    // Gap for future storage changes
    uint256[44] private __gap;
}
