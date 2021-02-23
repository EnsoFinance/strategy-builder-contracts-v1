//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

contract PortfolioTokenStorage {
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public PERMIT_TYPEHASH;

    mapping(address => uint256) internal _balances;
    mapping(address => uint256) internal _nonces;
    mapping(address => mapping(address => uint256)) internal _allowances;
    uint256 internal _totalSupply;
    string internal _name;
    string internal _symbol;
    uint256 internal _version;
    uint8 internal _decimals;

    address internal _controller;
    address internal _factory;
    address internal _manager;
    address[] internal _tokens;
    mapping(address => uint256) internal _tokenPercentages;

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
