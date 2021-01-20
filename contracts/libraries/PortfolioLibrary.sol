//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IPortfolio.sol";
import "../interfaces/IOracle.sol";


library PortfolioLibrary {
    using SafeMath for uint256;
    uint256 private constant DIVISOR = 1000;

    /*
     * @notice This function verifies that the structure passed in parameters is valid
     * @dev We check that the array lengths match, that the percentages add 100%,
     *      no zero addresses, and no duplicates
     */
     // TODO: check for 0 percentage?
    function verifyStructure(
        address[] memory tokens,
        uint256[] memory percentages
    ) internal pure returns (bool) {
        require(
            tokens.length == percentages.length,
            "Portfolio._verifyAndSetStructure: Different array lengths"
        );
        uint256 total = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            require(
                tokens[i] != address(0),
                "Portfolio._verifyAndSetStructure: No zero address, please use WETH address"
            );
            require(
                i == 0 ||
                tokens[i] > tokens[i-1],
                "Portfolio._verifyAndSetStructure: Duplicate token address or addresses out of order"
            );
            total = total.add(percentages[i]);
        }
        require(
            total == DIVISOR,
            "Portfolio._verifyAndSetStructure: Percentages do not add up to 100%"
        );
        /*
        if (tokens.length != percentages.length) return false;
        uint256 total = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) return false;
            if (i != 0 && tokens[i] <= tokens[i-1]) return false;
            total = total.add(percentages[i]);
        }
        if (total != DIVISOR) return false;
        return true;
        */
    }

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
