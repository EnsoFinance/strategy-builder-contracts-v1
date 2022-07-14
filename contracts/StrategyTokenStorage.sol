//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./interfaces/IStrategyToken.sol";

contract StrategyTokenStorage {

    bytes32 public DOMAIN_SEPARATOR;

    mapping(address => mapping(address => uint256)) internal _allowances;
    mapping(address => uint256) internal _balances;
    mapping(address => uint256) internal _nonces;
    uint256 internal _totalSupply;

    uint224 internal _streamingFeeRate;
    uint16 internal _performanceFee;
    uint96 internal _lastStreamTimestamp;
    uint128 internal _lastTokenValue;
    mapping(address => uint256) internal _paidTokenValues;

    uint256 internal _managementFee;
    uint256 internal _managementFeeRate;

    address internal _strategy;
    
    // Gap for future storage changes
    uint256[50] private __gap; // in case this is behind a proxy
}
