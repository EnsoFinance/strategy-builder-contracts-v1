//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./StrategyTypes.sol";

abstract contract Timelocks is StrategyTypes {
    
    event TimelockSet(bytes32 identifier, uint256 value);
    event UpdateTimelock(uint256 delay, bool finalized);


    bytes constant public UNSET_VALUE = abi.encode(keccak256("Timelocks: unset value."));

    // updgradable implementations would benefit from the ability to set new timelocks.
    // not mandatory so suppressing "virtual". See EmergencyEstimator and StrategyController
    // for an example and non-example
    //function updateTimelock(bytes32 identifier, uint256 delay) external virtual;
    //function finalizeTimelock() external virtual;


    // delay value is not validated but is assumed to be sensible 
    // since this function is internal, this way `_timelockIsReady` will not overflow
    function _setTimelock(bytes32 identifier, uint256 delay) internal {
        TimelockData storage td = _timelockData(identifier); 
        require(delay <= uint128(-1), "_setTimelock: delay out of range.");
        td.delay = uint128(delay);
        td.value = UNSET_VALUE;
        emit TimelockSet(identifier, delay);
    }

    function _timelockData(bytes32 identifier) internal virtual returns(TimelockData storage);

    function _startTimelock(bytes32 identifier, bytes memory value) internal {
        TimelockData storage td = _timelockData(identifier); 
        td.timestamp = uint128(block.timestamp);
        td.value = value;
    }

    function _timelockIsReady(bytes32 identifier) internal returns(bool) {
        TimelockData memory td = _timelockData(identifier); 
        if (td.timestamp == 0) return false;
        if (uint128(block.timestamp) >= td.timestamp + td.delay) return true;
    }

    // unchecked, assumes caller has checked `isReady`
    function _getTimelockValue(bytes32 identifier) internal returns(bytes memory) {
        return _timelockData(identifier).value; 
    }

    function _resetTimelock(bytes32 identifier) internal {
        TimelockData storage td = _timelockData(identifier); 
        td.timestamp = 0;
        td.value = UNSET_VALUE;
    }
}
