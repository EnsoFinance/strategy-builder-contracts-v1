// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.6.0 <0.9.0;

interface IAaveIncentivesController {

    function getRewardsBalance(address[] calldata assets, address user) external view returns(uint256);

    function claimRewards(address[] calldata assets, uint256 amount, address to) external returns(uint256);

    function REWARD_TOKEN() external view returns(address);
}
