//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/SafeCast.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/IStrategyFees.sol";
import "./StrategyToken.sol";
import "./StrategyCommon.sol";

abstract contract StrategyFees is IStrategyFees, StrategyToken, StrategyCommon {

    uint256 private constant YEAR = 331556952; //365.2425 days
    uint256 internal constant DIVISOR = 1000;

    event StreamingFee(uint256 amount);
    event ManagementFee(uint256 amount);

    function updateAddresses() public {
        function(address, address)[2] memory callbacks;
        callbacks[0] = _issueStreamingFee;
        callbacks[1] = _updateStreamingFeeRate;
        _updateAddresses(callbacks);
    }

    function managementFee() external view returns (uint256) {
        uint256 managementFee = _managementFee;
        return managementFee.div(managementFee.add(PRECISION).div(DIVISOR));
    }

    /**
     * @notice Update the per token value based on the most recent strategy value. Only callable by controller
     * @param total The current total value of the strategy in WETH
     * @param supply The new supply of the token (updateTokenValue needs to be called before mint, so the new supply has to be passed in)
     */
    function updateTokenValue(uint256 total, uint256 supply) external override onlyController {
        _setTokenValue(total, supply);
    }

    /**
     * @notice Update the per token value based on the most recent strategy value.
     */
    function updateTokenValue() external {
        _setLock();
        _onlyManager();
        _updateTokenValue();
        _removeLock();
    }

    /**
     * @notice Update the performance fee. Only callable by controller
     */
    function updatePerformanceFee(uint16 fee) external override onlyController {
        revert("This strategy does not support performance fees");
    }

    /**
     * @notice Update the management fee. Only callable by controller
     */
    function updateManagementFee(uint16 fee) external override onlyController {
        address pool = _pool;
        address manager = _manager;
        _issueStreamingFee(pool, manager);
        _managementFee = PRECISION.mul(fee).div(DIVISOR.sub(fee));
        _updateStreamingFeeRate(pool, manager);
    }

    /**
     * @notice Issues the streaming fee to the fee pool. Only callable by controller
     */
    function issueStreamingFee() external override onlyController {
        _issueStreamingFee(_pool, _manager);
    }

    /**
     * @notice Withdraws the streaming fee to the fee pool
     */
    function withdrawStreamingFee() external {
        _setLock();
        _issueStreamingFee(_pool, _manager);
        _removeLock();
    }

    /**
     * @notice Issue streaming fee and burn remaining tokens. Returns the updated fee pool balance
     */
    function _issueStreamingFeeAndBurn(address pool, address manager, address account, uint256 amount) internal {
        _issueStreamingFee(pool, manager);
        _burn(account, amount);
        _updateStreamingFeeRate(pool, manager);
    }

    /**
     * @notice Sets the new _streamingFeeRate (and _managementFeeRate) which is the per year amount owed in streaming fees based on the current totalSupply (not counting supply held by the fee pool)
     */
    function _updateStreamingFeeRate(address pool, address manager) internal {
        uint256 streamingFee = IStrategyProxyFactory(_factory).streamingFee();
        uint256 poolBalance = _balances[pool];
        _streamingFeeRate = uint224(_totalSupply.sub(poolBalance).mul(streamingFee));
        uint256 managementFee = _managementFee;
        if (_managementFee > 0) {
           _managementFeeRate = _totalSupply.sub(poolBalance).sub(_balances[manager]).mul(managementFee);
        }
    }

    /**
     * @notice Mints new tokens to cover the streaming fee based on the time passed since last payment and the current streaming fee rate
     */
    function _issueStreamingFee(address pool, address manager) internal {
        uint256 timePassed = block.timestamp.sub(uint256(_lastStreamTimestamp));
        if (timePassed > 0) {
            uint256 amountToMint = uint256(_streamingFeeRate).mul(timePassed).div(YEAR).div(PRECISION);
            _mint(pool, amountToMint);
            emit StreamingFee(amountToMint);
            uint256 managementFeeRate = _managementFeeRate;
            if (managementFeeRate > 0) {
                amountToMint = uint256(managementFeeRate).mul(timePassed).div(YEAR).div(PRECISION);
                _mint(manager, amountToMint);
                emit ManagementFee(amountToMint);
            }
            _lastStreamTimestamp = uint96(block.timestamp);

        }
    }

    /**
     * @notice Update the per token value based on the most recent strategy value.
     */
    function _updateTokenValue() internal {
        if (_oracle != address(IStrategyController(_controller).oracle())) updateAddresses();
        (uint256 total, ) = IOracle(_oracle).estimateStrategy(IStrategy(address(this)));
        _setTokenValue(total, _totalSupply);
    }

    function _updatePaidTokenValue(address account, uint256 amount, uint256 tokenValue) internal {
        uint256 balance = _balances[account];
        if (balance == 0) {
            // If account doesn't have a balance, set paid token value to current token value
            _paidTokenValues[account] = tokenValue;
        } else {
            // Otherwise, calculate avg token value
            uint256 oldValue = balance.mul(_paidTokenValues[account]);
            uint256 newValue = amount.mul(tokenValue);
            _paidTokenValues[account] = oldValue.add(newValue).div(balance.add(amount));
        }
    }

    function _removePaidTokenValue(address account, uint256 amount) internal {
        if (_balances[account] <= amount) {
            // If user is exiting their position, reset paid token value
            delete _paidTokenValues[account];
        }
    }

    /**
     * @notice Sets the new _lastTokenValue based on the total price and token supply
     */
    function _setTokenValue(uint256 total, uint256 supply) internal {
        if (supply > 0) _lastTokenValue = SafeCast.toUint128(total.mul(PRECISION).div(supply));
    }
}
