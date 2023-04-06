//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IProtocolOracle.sol";

contract BasicEstimator is IEstimator {
    IProtocolOracle public immutable protocolOracle;

    constructor(address protocolOracle_) public {
      protocolOracle = IProtocolOracle(protocolOracle_);
    }

    function estimateItem(
        IStrategy strategy,
        address token
    ) public view override returns (int256) {
        uint256 balance = IERC20(token).balanceOf(address(strategy));
        return estimateItem(strategy, token, balance);
    }

    function estimateItem(
        IStrategy strategy,
        address token,
        uint256 balance
    ) public view override returns (int256) {
        (strategy); // silence compiler
        return int256(protocolOracle.consult(balance, token));
    }
}
