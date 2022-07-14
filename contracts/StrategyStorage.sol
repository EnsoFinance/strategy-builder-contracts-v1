//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./interfaces/IStrategyToken.sol";
import "./helpers/StrategyTypes.sol";

contract StrategyStorage is StrategyTypes {

    // where did the deprecated storage go? see this key
    // c means common
    // s means strategy, stays here! :)
    // t means token

    bytes32 public DEPRECATED_DOMAIN_SEPARATOR; // t
    mapping(address => mapping(address => uint256)) internal DEPRECATED_allowances; // t
    mapping(address => uint256) internal DEPRECATED_balances; // t
    mapping(address => uint256) internal DEPRECATED_nonces; // t
    uint256 internal DEPRECATED_totalSupply; // t


    string internal _name; // c
    string internal _symbol; // c
    string internal _version; // c
    uint8 internal _locked; // c 


    uint224 internal DEPRECATED_streamingFeeRate; // t
    uint16 internal DEPRECATED_performanceFee; // t

    
    uint16 internal _rebalanceThreshold; // s


    uint96 internal DEPRECATED_lastStreamTimestamp; // t
    uint128 internal DEPRECATED_lastTokenValue; // t
    mapping(address => uint256) internal DEPRECATED_paidTokenValues; // t


    address internal _manager; // c 
    address internal _pool; // c
    address internal _oracle; // c
    address internal _weth; // c
    address internal _susd; // c


    address internal _tempRouter; // s
    address[] internal _items; // s
    address[] internal _synths; // s
    address[] internal _debt; // s
    mapping(address => int256) internal _percentage; // s
    mapping(address => TradeData) internal _tradeData; // s
    mapping(bytes4 => TimelockData) internal __timelockData; // s


    uint256 internal DEPRECATED_managementFee; // t
    uint256 internal DEPRECATED_managementFeeRate; // t


    bytes[] internal _claimables; // s
    IStrategyToken internal _token; // s

    // Gap for future storage changes
    uint256[45] private __gap;
}
