//SPDX-License-Identifier: GPL-3.0 
pragma solidity 0.6.12;

import "./BinaryTreeWithPayload.sol";

library MemoryMappings {
    using BinaryTreeWithPayload for BinaryTreeWithPayload.Tree;

    function append(BinaryTreeWithPayload.Tree memory mm, bytes32 key, bytes32 value) internal pure returns(bool) {
        BinaryTreeWithPayload.Tree memory node = mm.get(uint256(key)); 
        bytes32[] memory arr;
        if (!node.exists) {
            arr = new bytes32[](1);
            arr[0] = value;
            mm.add(uint256(key), abi.encode(arr));
            return true; // isNew
        }
        (arr) = abi.decode(node.payload, (bytes32[]));
        assembly {
          // FIXME do I need free memory pointer??
            mstore(add(arr, add(mul(mload(arr), 32), 32)), value)
            let len := add(mload(arr), 1)
            mstore(arr, len)
        }
        mm.replace(uint256(key), abi.encode(arr));
    }

    function add(BinaryTreeWithPayload.Tree memory mm, bytes32 key, bytes32 value) internal pure {
        mm.add(uint256(key), abi.encode(value)); 
    }

    function add(BinaryTreeWithPayload.Tree memory mm, bytes memory key, bytes memory value) internal pure {
        add(mm, keccak256(key), value); 
    }

    function add(BinaryTreeWithPayload.Tree memory mm, bytes32 key, bytes memory value) internal pure {
        mm.add(uint256(key), value); 
    }

    function add(BinaryTreeWithPayload.Tree memory mm, bytes memory key, bytes32 value) internal pure {
        add(mm, keccak256(key), abi.encode(value)); 
    }

    function getValue(BinaryTreeWithPayload.Tree memory mm, bytes32 key) internal pure returns(bool ok, bytes memory ret) {
        BinaryTreeWithPayload.Tree memory node = mm.get(uint256(key)); 
        if (node.exists) {
            ok = true;
            ret = node.payload;
        }
    }

    function getValue(BinaryTreeWithPayload.Tree memory mm, bytes memory key) internal pure returns(bool ok, bytes memory ret) {
        return getValue(mm, keccak256(key));
    }
}
