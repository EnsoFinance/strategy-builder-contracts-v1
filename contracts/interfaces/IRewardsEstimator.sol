//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface IRewardsEstimator {
    function estimateUnclaimedRewards(
        address user,
        address token
    ) external view returns (int256);
}
