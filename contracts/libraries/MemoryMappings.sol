//SPDX-License-Identifier: GPL-3.0 
pragma solidity 0.6.12;

import "./BinaryTree.sol";
import "./BinaryTreeWithPayload.sol";

library MemoryMappings {
    using BinaryTree for BinaryTree.Tree;
    using BinaryTreeWithPayload for BinaryTreeWithPayload.Tree;

    function append(BinaryTreeWithPayload.Tree memory mm, bytes32 key, bytes32 value) internal pure returns(bool) {
        BinaryTreeWithPayload.Tree memory node = mm.get(uint256(key)); 
        bytes32[] memory arr;
        if (!node.exists) {
            arr = new bytes32[](1);
            arr[0] = value;
            mm.push(uint256(key), abi.encode(arr));
            return true; // isNew
        }
        (arr) = abi.decode(node.payload, (bytes32[]));
        assembly {
            mstore(add(arr, add(mul(mload(arr), 32), 32)), value)
            let len := add(mload(arr), 1)
            mstore(arr, len)
        }
        mm.replace(uint256(key), abi.encode(arr));
    }

    function push(BinaryTree.Tree memory mm, bytes32 key) internal pure {
        mm.push(uint256(key)); 
    }

    function push(BinaryTree.Tree memory mm, bytes memory key) internal pure {
        push(mm, keccak256(key)); 
    }

    function push(BinaryTreeWithPayload.Tree memory mm, bytes32 key, bytes32 value) internal pure {
        mm.push(uint256(key), abi.encode(value)); 
    }

    function push(BinaryTreeWithPayload.Tree memory mm, bytes memory key, bytes memory value) internal pure {
        push(mm, keccak256(key), value); 
    }

    function push(BinaryTreeWithPayload.Tree memory mm, bytes32 key, bytes memory value) internal pure {
        mm.push(uint256(key), value); 
    }

    function push(BinaryTreeWithPayload.Tree memory mm, bytes memory key, bytes32 value) internal pure {
        push(mm, keccak256(key), abi.encode(value)); 
    }

    function doesExist(BinaryTree.Tree memory mm, bytes32 key) internal pure returns(bool ok) {
        BinaryTree.Tree memory node = mm.get(uint256(key)); 
        if (node.exists) {
            ok = true;
        }
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
