//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./helpers/StrategyTypes.sol";

contract StrategyTokenStorage is StrategyTypes {
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public PERMIT_TYPEHASH;

    mapping(address => mapping(address => uint256)) internal _allowances;
    mapping(address => uint256) internal _balances;
    mapping(address => uint256) internal _nonces;
    uint256 internal _totalSupply;
    string internal _name;
    string internal _symbol;
    string internal _version;
    uint8 internal _decimals;

    uint256 internal _lastStreamTimestamp;
    uint256 internal _lastTokenValue;
    mapping(address => uint256) internal _paidTokenValues;
    
    uint256 internal _locked;
    address internal _controller;
    address internal _factory;
    address internal _manager;
    mapping(address => uint256) internal _signers;

    address[] internal _items;
    address[] internal _synths;
    address[] internal _debt;
    mapping(address => int256) internal _percentage;
    mapping(address => TradeData) internal _tradeData;
}
