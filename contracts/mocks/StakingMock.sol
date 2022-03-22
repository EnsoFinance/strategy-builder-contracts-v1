// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

import "./DELETE_DONT_COMMIT/Staking.sol";

//import "@enso/staking/src/Staking.sol";

// mock class using Staking 
contract StakingMock is Staking {

  constructor(address stakingToken) Staking(stakingToken) {
  }

}
