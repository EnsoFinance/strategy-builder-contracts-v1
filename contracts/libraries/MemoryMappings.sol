//SPDX-License-Identifier: GPL-3.0 
pragma solidity 0.6.12;

import "./BinaryTreeWithPayload.sol";

library MemoryMappings {
    using BinaryTreeWithPayload for BinaryTreeWithPayload.Tree;

    function append(BinaryTreeWithPayload.Tree memory mm, bytes32 key, bytes32 value) internal pure returns(bool) {
        BinaryTreeWithPayload.Tree memory node = mm.get(uint256(key)); 
        if (!node.exists) {
            mm.add(uint256(key), abi.encode(value));
            return true; // isNew
        }
        bytes memory payload = node.payload;
        bytes32[] memory toStore;
        if (payload.length > 32) { // is bytes32[] FIXME ??
            (bytes32[] memory arr) = abi.decode(payload, (bytes32[]));    
            toStore = new bytes32[](arr.length + 1);
            // FIXME need more efficient copy/append
            uint256 i;
            for (; i < arr.length; ++i) { // FIXME use efficient append
                toStore[i] = arr[i]; 
            }
            toStore[i] = value;
        } else { // is bytes32
            // FIXME optimize using assembly
            (bytes32 singleton) = abi.decode(payload, (bytes32));
            toStore = new bytes32[](2);
            toStore[0] = singleton;
            toStore[1] = value;
        }
        mm.add(uint256(key), abi.encode(toStore));
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
