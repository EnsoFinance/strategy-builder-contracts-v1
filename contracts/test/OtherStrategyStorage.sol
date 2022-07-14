//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../interfaces/IStrategyToken.sol";
import "../helpers/StrategyTypes.sol";

contract OtherStrategyStorage is StrategyTypes {

    // where did the deprecated storage go? see this key
     means common

    bytes32 public DEPRECATED_DOMAIN_SEPARATOR; // t

    mapping(address => mapping(address => uint256)) internal DEPRECATED_allowances; // t
    mapping(address => uint256) internal DEPRECATED_balances; // t
    mapping(address => uint256) internal DEPRECATED_nonces; // t
    uint256 internal DEPRECATED_totalSupply; // t


    string internal _name; 
    string internal _symbol; 
    string internal _version; 
    uint8 internal _locked;  

    uint224 internal DEPRECATED_streamingFeeRate; // t
    uint16 internal DEPRECATED_performanceFee; // t

    uint16 internal _rebalanceThreshold; 

    uint96 internal DEPRECATED_lastStreamTimestamp; // t
    uint128 internal DEPRECATED_lastTokenValue; // t
    mapping(address => uint256) internal DEPRECATED_paidTokenValues; // t

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
    mapping(bytes4 => TimelockData) internal __timelockData; 

    uint256 internal DEPRECATED_managementFee; // t
    uint256 internal DEPRECATED_managementFeeRate; // t

    bytes[] internal _claimables; 

    IStrategyToken internal _token; 

    // New storage slots
    uint256[2] public OTHERVARIABLES;

    // Gap for future storage changes
    uint256[43] private __gap;
}
