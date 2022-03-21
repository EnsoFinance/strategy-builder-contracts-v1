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
        /*
         The Staking.unstakeFor flow is distributionToken -> stakedToken 
           where the amount of received stakedToken being min(amount, userStakes[user].amount)+userRewards[user].owed, a function of the user, which is the Strategy.
        */
        return IOracle(msg.sender).estimateItem(balance, address(enso));
    }
}
