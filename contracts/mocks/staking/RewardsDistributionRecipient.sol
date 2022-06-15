//pragma solidity ^0.5.16;
pragma solidity >=0.6.0 <0.8.0;

// WARNING: DO NOT USE IN PRODUCTION. MODIFIED FOR MOCK TESTING SIMPLICITY

// Inheritance
import "./Owned.sol";

// https://docs.synthetix.io/contracts/source/contracts/rewardsdistributionrecipient
contract RewardsDistributionRecipient is Owned {
    address public rewardsDistribution;

    constructor(address _owner) Owned(_owner) {}

    function notifyRewardAmount(uint256 reward) external virtual {}

    modifier onlyRewardsDistribution() {
        require(msg.sender == rewardsDistribution, "Caller is not RewardsDistribution contract");
        _;
    }

    function setRewardsDistribution(address _rewardsDistribution) external onlyOwner {
        rewardsDistribution = _rewardsDistribution;
    }
}
