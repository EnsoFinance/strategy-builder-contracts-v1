//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/IStrategyProxyFactory.sol";
import "./StrategyTokenStorage.sol";

contract StrategyCommon is StrategyTokenStorage {

    uint256 internal constant PRECISION = 10**18;

    address internal immutable _factory;
    address internal immutable _controller;

    constructor(address factory_, address controller_) public {
        _factory = factory_;
        _controller = controller_;
    }

    /**
     * @dev Throws if called by any account other than the controller.
     */
    function _onlyController() internal {
        if (msg.sender != _controller) revert("Controller only");
    }

    function _onlyManager() internal view {
        if (msg.sender != _manager) revert("Not manager");
    }

    /**
     * @notice Sets Reentrancy guard
     */
    function _setLock(uint8 lockType) internal {
        if (_locked % 2 == 1) revert("No Reentrancy");
        if (lockType % 2 == 0) revert("Invalid lock type");
        _locked = lockType;
    }

    /**
     * @notice Removes reentrancy guard.
     */
    function _removeLock() internal {
        _locked = 2;
    }
}
