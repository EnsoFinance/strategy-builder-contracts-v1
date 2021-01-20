// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

contract ReentrancyGuard {
    bool private txLock = false;

    modifier lock() {
        require(!txLock, "No Reentrancy");
        txLock = true;
        _;
        txLock = false;
    }
}
