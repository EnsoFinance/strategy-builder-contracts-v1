//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./StrategyTokenStorage.sol";

contract TestStorage is StrategyTokenStorage {
    
    constructor() public {
    
    }

    function test() external {
        _version = "hakuna matata";
        _streamingFeeRate = 123;
    }
}
