//pragma solidity >=0.4.24;
pragma solidity >=0.6.0 <0.8.0;

// WARNING: DO NOT USE IN PRODUCTION. MODIFIED FOR MOCK TESTING SIMPLICITY

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// https://docs.synthetix.io/contracts/source/interfaces/istakingrewards
interface IStakingRewards {
    // Views

    function balanceOf(address account) external view returns (uint256);

    function earned(address account) external view returns (uint256);

    function getRewardForDuration() external view returns (uint256);

    function lastTimeRewardApplicable() external view returns (uint256);

    function rewardPerToken() external view returns (uint256);

    //function rewardsDistribution() external view returns (address);

    function rewardsToken() external view returns (IERC20);

    function totalSupply() external view returns (uint256);

    // Mutative

    function exit() external;

    function getReward() external;

    function stake(uint256 amount) external;

    function withdraw(uint256 amount) external;
}
