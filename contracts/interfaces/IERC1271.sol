// SPDX-License-Identifier: CC0-1.0
pragma solidity >=0.5.0 <0.7.0;

interface IERC1271 {
 function isValidSignature(
   bytes calldata _messageHash,
   bytes calldata _signature)
   external
   view
   returns (bytes4 magicValue);
}
