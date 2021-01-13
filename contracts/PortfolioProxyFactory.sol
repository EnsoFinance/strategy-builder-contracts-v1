// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import './Portfolio.sol';

contract PortfolioProxyFactory {
    address public implementation;
    address public whitelist;
    address public oracle;
    address public controller;
    uint256 public constant version = 1;

    event NewPortfolio(address portfolio, address manager);

    constructor(
        address _implementation,
        address _oracle,
        address _whitelist,
        address _controller
    ) public {
        implementation = _implementation;
        oracle = _oracle;
        whitelist = _whitelist;
        controller = _controller;
    }

    function createPortfolio(
        string memory name,
        string memory symbol,
        address[] memory tokens,
        uint256[] memory percentages
    ) external {
        Portfolio proxy = new Portfolio(msg.sender, oracle, whitelist, name, symbol, 0, tokens, percentages);
        emit NewPortfolio(address(proxy), msg.sender);
    }
}
