//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./OtherStrategyTokenStorage.sol";

import "hardhat/console.sol";

contract TestStorageUpgrade is OtherStrategyTokenStorage {
    
    constructor() public {
    
    }

    function test() external {
        console.log("testing");
        require(keccak256(abi.encodePacked(_version)) == keccak256(abi.encodePacked("hakuna matata")), "not ok");
        require(_streamingFeeRate == uint224(123), "WRONG");
    }
}
