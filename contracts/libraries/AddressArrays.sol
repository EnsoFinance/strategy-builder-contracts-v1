//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;

import "./BinaryTreeWithPayload.sol";

library AddressArrays {
    using BinaryTreeWithPayload for BinaryTreeWithPayload.Tree;

    // @notice Returns all values from array1 and array2 without duplicates
    function merge(address[] memory array1, address[] memory array2) internal pure returns (address[] memory merged) {
        BinaryTreeWithPayload.Tree memory tree = BinaryTreeWithPayload.newNode();
        uint256 count;
        for (uint256 i; i < array1.length; ++i) {
            if (tree.replace(uint256(uint160(array1[i])), new bytes(0))) count++;
        }
        for (uint256 i; i < array2.length; ++i) {
            if (tree.replace(uint256(uint160(array2[i])), new bytes(0))) count++;
        }
        if (count > 0) {
            merged = new address[](count);
            readInto(tree, merged, 0);
        }
    }

    // @notice Returns all values in array1 that are not also in array2
    function reduce(address[] memory array1, address[] memory array2) internal pure returns (address[] memory reduced) {
        BinaryTreeWithPayload.Tree memory tree2 = BinaryTreeWithPayload.newNode();
        for (uint256 i; i < array2.length; ++i) {
            tree2.add(uint256(uint160(array2[i])), new bytes(0));
        }
        BinaryTreeWithPayload.Tree memory tree1 = BinaryTreeWithPayload.newNode();
        uint256 count;
        for (uint256 i; i < array1.length; ++i) {
            uint256 key = uint256(uint160(array1[i]));
            // If key is found in tree2, don't include it in tree1
            if (!tree2.get(key).exists) {
                tree1.add(key, new bytes(0));
                count++;
            }
        }
        if (count > 0) {
            reduced = new address[](count);
            readInto(tree1, reduced, 0);
        }
    }

    function readInto(BinaryTreeWithPayload.Tree memory tree, address[] memory array, uint256 idx) private pure {
        if (tree.neighbors[0].exists) readInto(tree.neighbors[0], array, idx); // left
        // center
        array[idx] = address(uint160(tree.value));
        ++idx;
        if (tree.neighbors[1].exists) readInto(tree.neighbors[1], array, idx); // right
    }
}
