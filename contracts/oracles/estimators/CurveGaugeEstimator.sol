//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IRewardsEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/curve/ICurveGauge.sol";

contract CurveGaugeEstimator is IEstimator, IRewardsEstimator {
    using SignedSafeMath for int256;
    
    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        return _estimateItem(balance, token);
    }

    function estimateItem(address user, address token) public view override returns (int256) { 
        uint256 balance = IERC20(token).balanceOf(address(user));
        return _estimateItem(balance, token);
    }

    function estimateUnclaimedRewards(address user, address token) external view override returns(int256) {
        return _estimateUnclaimedRewards(user, token); 
    }

    function _estimateItem(uint256 balance, address token) private view returns (int256) {
        address underlyingToken = ICurveGauge(token).lp_token();
        return IOracle(msg.sender).estimateItem(balance, underlyingToken);
    }

    function _estimateUnclaimedRewards(address user, address token) private view returns(int256) {
        // the token is the gauge token
        ICurveGauge gauge = ICurveGauge(token);
        address[] memory rewardTokens = new address[](8); // 8 is max in curve
        uint256 i;
        for (; i < 8; ++i) {
            rewardTokens[i] = gauge.reward_tokens(i); 
            if (rewardTokens[i] == address(0)) break;
        }
        if (rewardTokens[0] == address(0)) i = 0;
        assembly {
            mstore(rewardTokens, i) // this resizes ret so there won't be useless zero entries
        }
        int256 total;
        address rewardToken;
        int256 estimate;
        
        i = 0;
        for (; i < rewardTokens.length; ++i) {
            rewardToken = rewardTokens[i];
            estimate = IOracle(msg.sender).estimateItem(
                gauge.claimable_reward(user, rewardToken), 
                rewardToken);
            total = total.add(estimate); 
        }
        return total;
    }
}
