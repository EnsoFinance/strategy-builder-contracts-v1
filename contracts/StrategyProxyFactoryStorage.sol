//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;


contract StrategyProxyFactoryStorage {
    address public admin; //Not part of IStrategyProxyFactory, so can be public
    address public owner; //Not part of IStrategyProxyFactory, so can be public
    address internal _whitelist;
    address internal _oracle;
    address internal _pool;
    address internal _registry;
    address internal _implementation;
    string internal _version;

    uint256 _streamingFee;
    bytes32 _creationCodeHash;

    // Gap for future storage changes
    uint256[48] private __gap;
}
