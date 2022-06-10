//SPDX-License-Identifier: GPL-3.0 
pragma solidity 0.6.12;

import "./BinaryTreeWithPayload.sol";

library MemoryMappings {
    using BinaryTreeWithPayload for BinaryTreeWithPayload.Tree;

    struct MemoryMapping {
        BinaryTreeWithPayload.Tree tree;
    }

    function newMemoryMapping() internal pure returns(MemoryMapping memory) {
        return MemoryMapping({tree: BinaryTreeWithPayload.newNode()}); 
    }

    function newMemoryMapping(bytes32 key, bytes memory value) internal pure returns(MemoryMapping memory) {
        return MemoryMapping({tree: BinaryTreeWithPayload.newNode(uint256(key), value)}); 
    }

    function add(MemoryMapping memory mm, bytes32 key, bytes32 value) internal pure {
        mm.tree.add(uint256(key), abi.encode(value)); 
    }

    function add(MemoryMapping memory mm, bytes memory key, bytes memory value) internal pure {
        add(mm, keccak256(key), value); 
    }

    function add(MemoryMapping memory mm, bytes32 key, bytes memory value) internal pure {
        mm.tree.add(uint256(key), value); 
    }

    function add(MemoryMapping memory mm, bytes memory key, bytes32 value) internal pure {
        add(mm, keccak256(key), abi.encode(value)); 
    }

    function get(MemoryMapping memory mm, bytes32 key) internal pure returns(bool ok, bytes memory ret) {
        BinaryTreeWithPayload.Tree memory node = mm.tree.get(uint256(key)); 
        if (node.exists) {
            ok = true;
            ret = node.payload;
        }
    }

    function get(MemoryMapping memory mm, bytes memory key) internal pure returns(bool ok, bytes memory ret) {
        return get(mm, keccak256(key));
    }
}
