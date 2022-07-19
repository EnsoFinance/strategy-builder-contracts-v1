//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "../interfaces/IStrategy.sol";

library StrategyLibrary {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    int256 private constant DIVISOR = 1000;

    function getExpectedTokenValue(
        uint256 total,
        address strategy,
        address token
    ) public view returns (int256) {
        int256 percentage = IStrategy(strategy).getPercentage(token);
        if (percentage == 0) return 0;
        return int256(total).mul(percentage).div(DIVISOR);
    }

    function getRange(int256 expectedValue, uint256 threshold) public pure returns (int256) {
        if (threshold == 0) return 0;
        return expectedValue.mul(int256(threshold)).div(DIVISOR);
    }
}
