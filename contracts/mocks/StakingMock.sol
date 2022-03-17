// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

//import "@enso/staking/src/Staking.sol";

import "./src/Staking.sol"; // debug

// mock class using Staking 
contract StakingMock is Staking {

  uint32 public advanceBy;

  constructor(address stakingToken) Staking(stakingToken) {
      advanceBy = 1 hours;
  }

  function currentHour() public override view returns(uint32 hour) {
    hour = super.currentHour();
    hour = hour + advanceBy; // no safe math since this is internal test and `advanceBy` should be sensible
  }

  function advanceClock(uint32 advanceBy_) public {
      advanceBy = advanceBy_;
  }

}
