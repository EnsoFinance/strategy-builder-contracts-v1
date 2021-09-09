// SPDX-License-Identifier: CC0-1.0
pragma solidity >=0.5.0 <0.8.0;

interface IERC1271 {
  function isValidSignature(
      bytes32 _hash,
      bytes calldata _signature
  ) external view returns (bytes4 magicValue);

    function isValidSignature(
       bytes calldata _message,
       bytes calldata _signature
    ) external view returns (bytes4 magicValue);
}
