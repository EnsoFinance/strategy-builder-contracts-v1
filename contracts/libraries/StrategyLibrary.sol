//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IStrategyController.sol";
import "../interfaces/IOracle.sol";

library StrategyLibrary {
    using SafeMath for uint256;
    uint256 private constant DIVISOR = 1000;

    function checkBalance(
        address strategy,
        address[] memory tokens,
        uint256 threshold
    ) internal view returns (bool) {
        address oracle = IStrategy(strategy).oracle();
        (uint256 total, uint256[] memory estimates) =
            IOracle(oracle).estimateTotal(strategy, tokens);
        bool balanced = true;
        for (uint256 i = 0; i < tokens.length; i++) {
            address tokenAddress = tokens[i];
            uint256 expectedValue = getExpectedTokenValue(total, strategy, tokenAddress);
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

    function getTokenValue(address strategy, address token) internal view returns (uint256) {
        IOracle oracle = IOracle(IStrategy(strategy).oracle());
        if (token == address(0)) {
            return strategy.balance;
        } else if (token == oracle.weth()) {
            return IERC20(token).balanceOf(strategy);
        } else {
            return oracle.consult(IERC20(token).balanceOf(strategy), token);
        }
    }

    function getExpectedTokenValue(
        uint256 total,
        address strategy,
        address token
    ) internal view returns (uint256) {
        return total.mul(IStrategy(strategy).percentage(token)).div(DIVISOR);
    }

    function getRange(uint256 expectedValue, uint256 threshold) internal pure returns (uint256) {
        if (threshold == 0) return 0;
        return expectedValue.mul(threshold).div(DIVISOR);
    }
}
