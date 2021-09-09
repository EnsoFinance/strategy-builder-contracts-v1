//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/aave/IAToken.sol";

contract AaveEstimator is IEstimator {
    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        address underlyingToken = IAToken(token).UNDERLYING_ASSET_ADDRESS();
        return IOracle(msg.sender).estimateItem(balance, underlyingToken);
    }
}