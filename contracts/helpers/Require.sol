//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./StringUtils.sol";

contract Require is StringUtils {
     function _require(bool condition, uint256 code) internal pure {
        if (condition) return;
        revert(toString(code));
    }
}
