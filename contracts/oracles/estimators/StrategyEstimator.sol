//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/IStrategy.sol";
import "../../interfaces/IStrategyToken.sol";

contract StrategyEstimator is IEstimator {
    using SafeMath for uint256;

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        return _estimateItem(balance, token);
    }

    function estimateItem(address user, address token) public view override returns (int256) { 
        uint256 balance = IStrategy(token).token().balanceOf(address(user));
        return _estimateItem(balance, token);
    }

    function _estimateItem(uint256 balance, address token) private view returns (int256) {
        require(!IStrategy(token).locked(), "Strategy locked"); // Prevents inflating value of child strategy temporarily
        IStrategyToken strategyToken = IStrategy(token).token();
        uint256 totalSupply = strategyToken.totalSupply();
        (uint256 totalValue, ) = IOracle(msg.sender).estimateStrategy(IStrategy(token));
        return int256(totalValue.mul(balance).div(totalSupply));
    }

}
