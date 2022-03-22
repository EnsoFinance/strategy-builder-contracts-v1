//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/SafeCast.sol";
import "../../interfaces/IStakedEnso.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";


contract StakedEnsoEstimator is IEstimator {
    using SafeMath for uint256;

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        IStakedEnso sEnso = IStakedEnso(token);
        IERC20 enso = IStakedEnso(token).enso();
        uint256 amount = balance.mul(uint256(sEnso.maxHours())).div(3); 
        return IOracle(msg.sender).estimateItem(amount, address(enso));
    }

    function estimateItem(address user, address token) public view override returns (int256) { 
      // TODO
    }
}
