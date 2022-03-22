//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../../interfaces/IEstimator.sol";
import "../../interfaces/IProtocolOracle.sol";

contract BasicEstimator is IEstimator {
    IProtocolOracle public immutable protocolOracle;

    constructor(address protocolOracle_) public {
      protocolOracle = IProtocolOracle(protocolOracle_);
    }

    function estimateItem(uint256 balance, address token) public override returns (int256) {
        return int256(protocolOracle.consult(balance, token));
    }

    function estimateItem(address user, address token) public override returns (int256) { 
        revert("estimateItem: address parameter not supported.");
    }
}
