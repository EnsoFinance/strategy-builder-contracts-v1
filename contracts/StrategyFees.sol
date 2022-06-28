//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/IStrategyFees.sol";
import "./StrategyToken.sol";
import "./StrategyCommon.sol";

abstract contract StrategyFees is IStrategyFees, StrategyToken, StrategyCommon {

    uint256 private constant YEAR = 331556952; //365.2425 days
    uint256 internal constant PRECISION = 10**18;
    uint256 internal constant DIVISOR = 1000;

    // Streaming fee: The streaming fee streams 0.1% of the strategy's value over
    // a year via inflation. The multiplier (0.001001001) is used to calculate
    // the amount of tokens that need to be minted over a year to give the fee
    // pool 0.1% of the tokens (STREAM_FEE*totalSupply)
    uint256 public constant STREAM_FEE = uint256(1001001001001001);

    event StreamingFee(uint256 amount);
    event ManagementFee(uint256 amount);

    function managementFee() external view returns (uint256) {
        uint256 managementFee = _managementFee;
        return managementFee.div(managementFee.add(PRECISION).div(DIVISOR));
    }

    /**
     * @notice Issues the streaming fee to the fee pool. Only callable by controller
     */
    function issueStreamingFee() external override onlyController {
        _issueStreamingFee(_pool, _manager);
    }

    function updatePerformanceFee(uint16 fee) external override onlyController {
        revert("This strategy does not support performance fees");
    }

    function updateManagementFee(uint16 fee) external override onlyController {
        address pool = _pool;
        address manager = _manager;
        _issueStreamingFee(pool, manager);
        _managementFee = PRECISION.mul(fee).div(DIVISOR.sub(fee));
        _updateStreamingFeeRate(pool, manager);
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
        uint256 poolBalance = _balances[pool];
        _streamingFeeRate = uint224(_totalSupply.sub(poolBalance).mul(STREAM_FEE));
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
}
