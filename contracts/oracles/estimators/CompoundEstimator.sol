//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/compound/ICToken.sol";

contract CompoundEstimator is IEstimator {
    using SafeMath for uint256;

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        address underlyingToken = ICToken(token).underlying();
        uint256 share = balance.mul(ICToken(token).exchangeRateStored()).div(10**18);
        return IOracle(msg.sender).estimateItem(share, underlyingToken);
    }

    function estimateItem(address user, address token) public view override returns (int256) { 
        revert("estimateItem: address parameter not supported.");
    }
}
