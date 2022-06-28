//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/IOracle.sol";
import "./interfaces/IStrategyProxyFactory.sol";
import "./StrategyToken.sol";

contract StrategyCommon is StrategyToken {

    address internal immutable _factory;
    address internal immutable _controller;

    constructor(address factory_, address controller_) public {
        _factory = factory_;
        _controller = controller_;
    }

    /**
        @notice Refresh Strategy's addresses
     */
    function _updateAddresses(function(address, address)[2] memory callbacks) internal {
        IStrategyProxyFactory f = IStrategyProxyFactory(_factory);
        address newPool = f.pool();
        address currentPool = _pool;
        if (newPool != currentPool) {
            // If pool has been initialized but is now changing update paidTokenValue
            if (currentPool != address(0)) {
                address manager = _manager;
                //_issueStreamingFee(currentPool, manager);
                //_updateStreamingFeeRate(newPool, manager);
                callbacks[0](currentPool, manager);
                callbacks[1](newPool, manager);
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
    modifier onlyController() {
        require(_controller == msg.sender, "Controller only");
        _;
    }

    function _onlyManager() internal view {
        require(msg.sender == _manager, "Not manager");
    }

    /**
     * @notice Sets Reentrancy guard
     */
    function _setLock() internal {
        require(_locked == 0, "No Reentrancy");
        _locked = 1;
    }

    /**
     * @notice Removes reentrancy guard.
     */
    function _removeLock() internal {
        _locked = 0;
    }
}
