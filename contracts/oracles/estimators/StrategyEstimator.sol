//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/IStrategy.sol";

contract StrategyEstimator is IEstimator {
    using SafeMath for uint256;

    function estimateItem(uint256 balance, address token) public override returns (int256) {
        require(!IStrategy(token).locked(), "Strategy locked"); // Prevents inflating value of child strategy temporarily
        uint256 totalSupply = IStrategy(token).totalSupply();
        (uint256 totalValue, ) = IOracle(msg.sender).estimateStrategy(IStrategy(token));
        return int256(totalValue.mul(balance).div(totalSupply));
    }

    function estimateItem(address user, address token) public override returns (int256) { 
        revert("estimateItem: address parameter not supported.");
    }
}
