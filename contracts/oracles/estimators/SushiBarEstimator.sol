//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/sushi/ISushiBar.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";

contract SushiBarEstimator is IEstimator {
    using SafeMath for uint256;

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        ISushiBar xsushi = ISushiBar(token);
        IERC20 sushi = IERC20(xsushi.sushi());
        uint256 totalShares = xsushi.totalSupply();
        uint256 amount = balance.mul(sushi.balanceOf(address(xsushi))).div(totalShares);
        return IOracle(msg.sender).estimateItem(amount, address(sushi));
    }
}
