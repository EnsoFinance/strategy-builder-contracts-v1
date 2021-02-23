//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "../interfaces/IOracle.sol";
import "../interfaces/IPortfolio.sol";
import "../interfaces/IPortfolioController.sol";
import "../libraries/PortfolioLibrary.sol";

contract LibraryWrapper {
    IOracle public oracle;
    IPortfolio public portfolio;

    constructor(address oracle_, address portfolio_) public {
        oracle = IOracle(oracle_);
        portfolio = IPortfolio(portfolio_);
    }

    function isBalanced() external view returns (bool) {
        return
            PortfolioLibrary.checkBalance(
                address(portfolio),
                portfolio.tokens(),
                IPortfolioController(portfolio.controller()).rebalanceThreshold(address(portfolio))
            );
    }

    function isRebalanceNeeded(uint256 alertThreshold) external view returns (bool) {
        bool balanced =
            PortfolioLibrary.checkBalance(address(portfolio), portfolio.tokens(), alertThreshold);
        return !balanced;
    }

    function getRebalanceRange(uint256 total) external view returns (uint256) {
        uint256 range =
            IPortfolioController(portfolio.controller()).rebalanceThreshold(address(portfolio));
        return PortfolioLibrary.getRange(total, range);
    }

    function getPortfolioValue() external view returns (uint256) {
        (uint256 total, ) = oracle.estimateTotal(address(portfolio), portfolio.tokens());
        return total;
    }

    function getTokenValue(address token) external view returns (uint256) {
        return PortfolioLibrary.getTokenValue(address(portfolio), token);
    }

    function getExpectedTokenValue(uint256 total, address token) external view returns (uint256) {
        return PortfolioLibrary.getExpectedTokenValue(total, address(portfolio), token);
    }
}
