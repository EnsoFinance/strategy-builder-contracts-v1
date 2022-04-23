//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";

library PreciseMath {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    int256 private constant PRECISION = 10**8;
    uint256 private constant uPRECISION = 10**8;

    function getPrecision() internal pure returns(uint256) {
        return uPRECISION; 
    }
    
    function mulp(uint256 a, uint256 b) internal pure returns(uint256) {
        return a.mul(b) / uPRECISION;
    }

    function divp(uint256 a, uint256 b) internal pure returns(uint256) {
        return a.mul(uPRECISION).div(b);
    }

    function mulp(int256 a, int256 b) internal pure returns(int256) {
        return a.mul(b) / PRECISION;
    }

    function divp(int256 a, int256 b) internal pure returns(int256) {
        return a.mul(PRECISION).div(b);
    }
}
