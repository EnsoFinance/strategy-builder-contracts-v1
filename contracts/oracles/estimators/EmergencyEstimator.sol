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
    mapping(bytes4 => TimelockData) private __timelockData;

    event EstimateSet(address token, int256 amount, bool finalized);

    constructor() public {
        _setTimelock(this.updateEstimate.selector, 5 minutes);
    }

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        return _estimateItem(balance, token);
    }

    function updateEstimate(address token, int256 amount) external onlyOwner {
        _startTimelock(this.updateEstimate.selector, abi.encode(token, amount));
        emit EstimateSet(token, amount, false);
    }

    function finalizeSetEstimate() external {
        require(_timelockIsReady(this.updateEstimate.selector), "finalizeSetEstimate: timelock not ready.");
        (address token, int256 amount) = abi.decode(_getTimelockValue(this.updateEstimate.selector), (address, int256));
        _resetTimelock(this.updateEstimate.selector);
        estimates[token] = amount;
        emit EstimateSet(token, amount, true);
    }

    function estimateItem(address user, address token) public view override returns (int256) { 
        uint256 balance = IERC20(token).balanceOf(address(user));
        return _estimateItem(balance, token);
    }

    function _estimateItem(uint256 balance, address token) private view returns (int256) {
        return int256(balance).mul(estimates[token]).div(int256(10**uint256(IERC20NonStandard(token).decimals())));
    }

    function _timelockData(bytes4 functionSelector) internal override returns(TimelockData storage) {
        return __timelockData[functionSelector];
    }
}
