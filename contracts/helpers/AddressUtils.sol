//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

contract AddressUtils {
    string public constant ZERO_ADDRESS = "Zero address provided";
    function _noZeroAddress(address addr) internal {
        require(addr != address(0), ZERO_ADDRESS);
    }
}
