//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

contract Timelocks {
    
    mapping(bytes4 => TimelockData) internal _timelockData;
    bytes constant public UNSET_VALUE = abi.encode(keccak256("Timelocks: unset value."));

    struct TimelockData {
        uint256 delay;
        uint256 timestamp;
        bytes value;
    }

    // delay value is not validated but is assumed to be sensible 
    // since this function is internal, this way `_timelockIsReady` will not overflow
    function _setTimelock(bytes4 selector, uint256 delay) internal {
        TimelockData storage td = _timelockData[selector]; 
        td.delay = delay;
        td.value = UNSET_VALUE;
    }

    function _startTimelock(bytes4 selector, bytes memory value) internal {
        TimelockData storage td = _timelockData[selector]; 
        td.timestamp = block.timestamp;
        td.value = value;
    }

    function _timelockIsReady(bytes4 selector) internal returns(bool) {
        TimelockData memory td = _timelockData[selector]; 
        if (td.timestamp == 0) return false;
        if (block.timestamp >= td.timestamp + td.delay) return true;
    }

    // unchecked, assumes caller has checked `isReady`
    function _getTimelockValue(bytes4 selector) internal returns(bytes memory) {
        return _timelockData[selector].value; 
    }

    function _resetTimelock(bytes4 selector) internal {
        TimelockData storage td = _timelockData[selector]; 
        td.timestamp = 0;
        td.value = UNSET_VALUE;
    }
}
