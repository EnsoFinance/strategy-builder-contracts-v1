pragma solidity 0.6.12;

import "../Strategy.sol";

contract LockableStrategy is Strategy {
    function lock() external {
        _setLock();
    }

    function unlock() external {
        _removeLock();
    }
}
