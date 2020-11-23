// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

import './Portfolio.sol';

contract PortfolioFactory {
    function createPortfolio() external returns (address portfolio) {
        return address(new Portfolio(msg.sender));
    }
}
