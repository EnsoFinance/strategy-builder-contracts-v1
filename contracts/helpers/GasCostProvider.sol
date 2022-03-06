//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";

contract GasCostProvider is Ownable {
    uint256 public gasCost;

    constructor(uint256 gasCost_, address owner_) public {
        gasCost = gasCost_;
        transferOwnership(owner_);
    }

    function updateGasCost(uint256 newGasCost) external onlyOwner {
        gasCost = newGasCost;
    }
}
