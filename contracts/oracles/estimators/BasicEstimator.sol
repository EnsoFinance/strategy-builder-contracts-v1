//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../../interfaces/IEstimator.sol";
import "../../interfaces/IProtocolOracle.sol";

contract BasicEstimator is IEstimator {
    IProtocolOracle public protocolOracle;

    constructor(address protocolOracle_) public {
      protocolOracle = IProtocolOracle(protocolOracle_);
    }

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        return int256(protocolOracle.consult(balance, token));
    }
}
