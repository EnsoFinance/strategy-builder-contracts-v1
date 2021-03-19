//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;


contract StrategyProxyFactoryStorage {
    address public _owner;
    address public _controller;
    address public _whitelist;
    address public _oracle;
    address public _implementation;
    uint256 public _version;
}
