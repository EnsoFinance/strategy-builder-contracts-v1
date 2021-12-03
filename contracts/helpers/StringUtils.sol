//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

contract StringUtils {
    function parseInt(string memory _value) internal pure returns (uint256 _ret) {
        bytes memory _bytesValue = bytes(_value);
        uint256 j = 1;
        for (uint256 i = _bytesValue.length - 1; i >= 0 && i < _bytesValue.length; i--) {
            require(
                uint8(_bytesValue[i]) >= 48 && uint8(_bytesValue[i]) <= 57,
                "Invalid string integer"
            );
            _ret += (uint8(_bytesValue[i]) - 48) * j;
            j *= 10;
        }
    }
}
