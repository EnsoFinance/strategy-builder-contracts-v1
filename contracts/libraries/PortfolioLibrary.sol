//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IPortfolio.sol";
import "../interfaces/IOracle.sol";


library PortfolioLibrary {
    using SafeMath for uint256;
    uint256 private constant DIVISOR = 1000;

    function checkBalance(
        address portfolio,
        address[] memory tokens,
        uint256 threshold
    ) internal view returns (bool) {
        address oracle = IPortfolio(portfolio).oracle();
        (uint256 total, uint256[] memory estimates) = IOracle(oracle).estimateTotal(portfolio, tokens);
        bool balanced = true;
        for (uint256 i = 0; i < tokens.length; i++) {
            address tokenAddress = tokens[i];
            uint256 expectedValue = getExpectedTokenValue(total, portfolio, tokenAddress);
            uint256 rebalanceRange = getRange(expectedValue, threshold);
            if (estimates[i] > expectedValue.add(rebalanceRange)) {
                balanced = false;
                break;
            }
            if (estimates[i] < expectedValue.sub(rebalanceRange)) {
                balanced = false;
                break;
            }
        }
        return balanced;
    }

    function imbalanceMagnitude(
        address portfolio,
        address[] memory tokens
    ) internal view returns (uint256) {
        address oracle = IPortfolio(portfolio).oracle();
        (uint256 total, uint256[] memory estimates) = IOracle(oracle).estimateTotal(portfolio, tokens);
        uint256 magnitude = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            address tokenAddress = tokens[i];
            uint256 expectedValue = getExpectedTokenValue(total, portfolio, tokenAddress);
            uint256 estimatedValue = estimates[i];
            if (estimatedValue > expectedValue) {
                magnitude = magnitude.add(estimatedValue.sub(expectedValue));
            }
            if (estimatedValue < expectedValue) {
                magnitude = magnitude.add(expectedValue.sub(estimatedValue));
            }
        }
        return magnitude;
    }

    function getTokenValue(address portfolio, address token)
        internal
        view
        returns (uint256)
    {
        IOracle oracle = IOracle(IPortfolio(portfolio).oracle());
        if (token == address(0)) {
            return address(this).balance;
        } else if (token == oracle.weth()) {
            return IERC20(token).balanceOf(portfolio);
        } else {
            return oracle.consult(
                IERC20(token).balanceOf(portfolio),
                token
            );
        }
    }

    function getExpectedTokenValue(
        uint256 total,
        address portfolio,
        address token
    ) internal view returns (uint256) {
        return total
            .mul(IPortfolio(portfolio).getTokenPercentage(token))
            .div(DIVISOR);
    }

    function getRange(uint256 expectedValue, uint256 threshold) internal pure returns (uint256) {
        return expectedValue.mul(threshold).div(DIVISOR);
    }
}
