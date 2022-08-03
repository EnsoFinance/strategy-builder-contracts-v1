//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";

contract StrategyEstimator is IEstimator {
    using SafeMath for uint256;

    function estimateItem(
        IStrategy strategy,
        address token
    ) public view override returns (int256) {
        uint256 balance = IERC20(token).balanceOf(address(strategy));
        return estimateItem(strategy, token, balance);
    }

    function estimateItem(
        IStrategy strategy,
        address token,
        uint256 balance
    ) public view override returns (int256) {
        (strategy);
        require(!IStrategy(token).locked(), "Strategy locked"); // Prevents inflating value of child strategy temporarily
        uint256 totalSupply = IStrategy(token).totalSupply();
        (uint256 totalValue, ) = IOracle(msg.sender).estimateStrategy(IStrategy(token));
        return int256(totalValue.mul(balance).div(totalSupply));
    }
}
