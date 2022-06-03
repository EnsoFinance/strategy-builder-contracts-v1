//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Timelocks.sol";

contract GasCostProvider is Ownable, Timelocks {
    uint256 public gasCost;
    event UpdateGasCost(uint256 gasCost, bool finalized);

    constructor(uint256 gasCost_, address owner_, uint256 gasCostTimelock) public {
        gasCost = gasCost_;
        transferOwnership(owner_);
        _setTimelock(this.updateGasCost.selector, gasCostTimelock);
    }

    function updateGasCost(uint256 newGasCost) external onlyOwner {
        _startTimelock(this.updateGasCost.selector, abi.encode(newGasCost));
        emit UpdateGasCost(newGasCost, false);
    }

    function finalizeGasCost() external {
        require(_timelockIsReady(this.updateGasCost.selector), "finalizeGasCost: timelock not ready.");
        uint256 newGasCost = abi.decode(_getTimelockValue(this.updateGasCost.selector), (uint256));
        _resetTimelock(this.updateGasCost.selector);
        emit UpdateGasCost(newGasCost, true);
    }
}
