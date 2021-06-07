//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./interfaces/IERC1271.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";


abstract contract ERC1271 is IERC1271 {
    using ECDSA for bytes32;

    bytes4 constant internal MAGICVALUE_BYTES = 0x20c13b0b;
    bytes4 constant internal MAGICVALUE_BYTES32 = 0x1626ba7e;
    bytes4 constant internal INVALID_SIGNATURE = 0xffffffff;

    function isValidSignature(
      bytes32 _hash,
      bytes memory _signature
    )
      public
      override
      view
      returns (bytes4 magicValue)
    {
      address signer = _hash.recover(_signature);
      magicValue = _checkSigner(signer) ? MAGICVALUE_BYTES32 : INVALID_SIGNATURE;
    }

    function isValidSignature(
      bytes memory _message,
      bytes memory _signature
    )
      public
      override
      view
      returns (bytes4 magicValue)
    {
      address signer = _getEthSignedMessageHash(_message).recover(_signature);
      magicValue = _checkSigner(signer) ? MAGICVALUE_BYTES : INVALID_SIGNATURE;
    }

    // @dev Adds ETH signed message prefix to bytes message and hashes it
    // @param _data Bytes data before adding the prefix
    // @return Prefixed and hashed message
    function _getEthSignedMessageHash(bytes memory _data) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n", _uint2str(_data.length), _data));
    }

    // @dev Convert uint to string
    // @param _num Uint to be converted
    // @return String equivalent of the uint
    function _uint2str(uint _num) private pure returns (string memory _uintAsString) {
        if (_num == 0) {
            return "0";
        }
        uint i = _num;
        uint j = _num;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (i != 0) {
            bstr[k--] = byte(uint8(48 + i % 10));
            i /= 10;
        }
        return string(bstr);
    }

    // @notice Confirm signer is permitted to sign on behalf of contract
    // @dev Abstract function to implemented by importing contract
    // @param signer The address of the message signer
    // @return Bool confirming whether signer is permitted
    function _checkSigner(address signer) internal view virtual returns (bool);
}
