//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IERC20NonStandard.sol";
import "../../helpers/Timelocks.sol";

contract EmergencyEstimator is IEstimator, Ownable, Timelocks {
    using SignedSafeMath for int256;

    mapping(address => int256) public estimates;
    mapping(bytes32 => TimelockData) private __timelockData;

    event EstimateSet(address token, int256 amount, bool finalized);

    constructor() public {
        _setTimelock(
          keccak256(abi.encode(this.updateEstimate.selector)), // identifier
          5 minutes);
    }

    function updateTimelock(bytes32 identifier, uint256 delay) external onlyOwner {
        _startTimelock(
          keccak256(abi.encode(this.updateTimelock.selector)), // identifier
          abi.encode(identifier, delay)); // payload
        emit UpdateTimelock(delay, false);
    }

    function finalizeTimelock() external {
        bytes32 key = keccak256(abi.encode(this.updateTimelock.selector));
        if (!_timelockIsReady(key)) {
            TimelockData memory td = _timelockData(key);
            require(td.delay == 0, "finalizeTimelock: timelock is not ready.");
        }
        (bytes32 identifier, uint256 delay) = abi.decode(_getTimelockValue(key), (bytes4, uint256));
        _setTimelock(identifier, delay);
        _resetTimelock(key);
        emit UpdateTimelock(delay, true);
    }

    function estimateItem(uint256 balance, address token) external view override returns (int256) {
        return _estimateItem(balance, token);
    }

    function updateEstimate(address token, int256 amount) external onlyOwner {
        _startTimelock(
          keccak256(abi.encode(this.updateEstimate.selector)), // identifier
          abi.encode(token, amount)); // payload
        emit EstimateSet(token, amount, false);
    }

    function finalizeSetEstimate() external {
        require(_timelockIsReady(keccak256(abi.encode(this.updateEstimate.selector))), "finalizeSetEstimate: timelock not ready.");
        (address token, int256 amount) = abi.decode(_getTimelockValue(keccak256(abi.encode(this.updateEstimate.selector))), (address, int256));
        _resetTimelock(keccak256(abi.encode(this.updateEstimate.selector)));
        estimates[token] = amount;
        emit EstimateSet(token, amount, true);
    }

    function estimateItem(address user, address token) external view override returns (int256) { 
        uint256 balance = IERC20(token).balanceOf(address(user));
        return _estimateItem(balance, token);
    }

    function _estimateItem(uint256 balance, address token) private view returns (int256) {
        return int256(balance).mul(estimates[token]) / int256(10**uint256(IERC20NonStandard(token).decimals()));
    }

    function _timelockData(bytes32 identifier) internal override returns(TimelockData storage) {
        return __timelockData[identifier];
    }
}
