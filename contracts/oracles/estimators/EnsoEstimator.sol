//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/SafeCast.sol";
import "../../interfaces/IStakedEnso.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/IStakedEnso.sol";


contract EnsoEstimator is IEstimator {
    using SafeMath for uint256;

    address private stakedEnso;
    address private basicEstimator;

    constructor(address stakedEnso_, address basicEstimator_) public {
      stakedEnso = stakedEnso_;
      basicEstimator = basicEstimator_;
    }

    function estimateItem(uint256 balance, address token) public view override returns (int256) { 
        return _estimateItem(balance, token);
    }

    function estimateItem(address user, address token) public view override returns (int256) { 
        IStakedEnso sEnso = IStakedEnso(stakedEnso);
        (uint256 lastRewardsPerToken, uint256 owed) = sEnso.userRewards(user);
        owed = owed.add(sEnso.unclaimedAmount(user));
        uint256 balance = IERC20(token).balanceOf(address(user));
        return _estimateItem(balance.add(owed), token);
    }

    function _estimateItem(uint256 balance, address token) private view returns(int256) {
        return IEstimator(basicEstimator).estimateItem(balance, token);
    }
}
