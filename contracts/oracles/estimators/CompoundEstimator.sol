//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/compound/ICToken.sol";

contract CompoundEstimator is IEstimator {
    using SafeMath for uint256;

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
        address underlyingToken = ICToken(token).underlying();
        uint256 share = balance.mul(ICToken(token).exchangeRateStored()).div(10**18);
        return IOracle(msg.sender).estimateItem(strategy, underlyingToken, share);
    }
}
