// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

import "@enso.contracts/staking/src/Staking.sol";

// mock class using Staking 
contract StakingMock is Staking {

  constructor(address stakingToken) Staking(stakingToken) {
  }

}
