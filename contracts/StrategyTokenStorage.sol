//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

contract StrategyTokenStorage {
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public PERMIT_TYPEHASH;

    mapping(address => uint256) internal _balances;
    mapping(address => uint256) internal _nonces;
    mapping(address => mapping(address => uint256)) internal _allowances;
    uint256 internal _totalSupply;
    string internal _name;
    string internal _symbol;
    string internal _version;
    uint8 internal _decimals;

    uint256 internal _locked;
    address internal _controller;
    address internal _factory;
    address internal _manager;
    address[] internal _strategyItems;
    mapping(address => uint256) internal _percentages;

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
