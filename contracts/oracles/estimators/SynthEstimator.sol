//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";

contract SynthEstimator is IEstimator {
    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        return int256(IOracle(msg.sender).chainlinkOracle().consult(balance, token));
    }
}
