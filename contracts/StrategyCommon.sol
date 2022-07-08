//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/IOracle.sol";
import "./interfaces/IStrategyController.sol";
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
        @notice Refresh Strategy's addresses
     */
    function _updateAddresses(function(address, address)[] memory callbacks) internal {
        IStrategyProxyFactory f = IStrategyProxyFactory(_factory);
        address newPool = f.pool();
        address currentPool = _pool;
        if (newPool != currentPool) {
            // If pool has been initialized but is now changing update paidTokenValue
            if (currentPool != address(0)) {
                address manager = _manager;
                if (callbacks.length == 2) {
                    callbacks[0](currentPool, manager); // perhaps .. _issueStreamingFee
                    callbacks[1](newPool, manager); // and _updateStreamingFeeRate
                }
                _paidTokenValues[currentPool] = _lastTokenValue;
            }
            _paidTokenValues[newPool] = uint256(-1);
            _pool = newPool;
        }
        address o = f.oracle();
        if (o != _oracle) {
            IOracle ensoOracle = IOracle(o);
            _oracle = o;
            _weth = ensoOracle.weth();
            _susd = ensoOracle.susd();
        }
    }

    /**
     * @dev Throws if called by any account other than the controller.
     */
    function _onlyController() internal {
        if (msg.sender != _controller) revert("Controller only");
    }

    function _onlyManager() internal view {
        if (msg.sender == _manager) revert("Not manager");
    }

    /**
     * @notice Sets Reentrancy guard
     */
    function _setLock() internal {
        if (_locked % 2 == 1) revert("No Reentrancy");
        _locked = 1;
    }

    /**
     * @notice Removes reentrancy guard.
     */
    function _removeLock() internal {
        _locked = 2;
    }
}
