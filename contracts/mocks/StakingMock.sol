// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

import "@ensofinance/staking/src/Staking.sol";

// mock class using Staking 
contract StakingMock is Staking {

  constructor(address stakingToken) Staking(stakingToken) {
  }

}
