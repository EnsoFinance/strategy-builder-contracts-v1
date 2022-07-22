//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;

import "./BinaryTreeWithPayload.sol";

library AddressArrays {
    using BinaryTreeWithPayload for BinaryTreeWithPayload.Tree;

    // @notice Returns all values from array1 and array2 (without duplicates)
    function with(address[] memory array1, address[] memory array2) internal view returns (address[] memory result) {
        BinaryTreeWithPayload.Tree memory tree = BinaryTreeWithPayload.newNode();
        uint256 count;
        for (uint256 i; i < array1.length; ++i) {
            if (tree.replace(uint256(uint160(array1[i])), new bytes(0))) count++;
        }
        for (uint256 i; i < array2.length; ++i) {
            if (tree.replace(uint256(uint160(array2[i])), new bytes(0))) count++;
        }
        if (count > 0) {
            result = new address[](count);
            readInto(tree, result, 0);
        }
    }

    // @notice Returns all values in array1 that are not also in array2
    function without(address[] memory array1, address[] memory array2) internal view returns (address[] memory result) {
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
            result = new address[](count);
            readInto(tree1, result, 0);
        }
    }

    function readInto(BinaryTreeWithPayload.Tree memory tree, address[] memory array, uint256 idx) private view returns (uint256) {
        if (tree.neighbors[0].exists) idx = readInto(tree.neighbors[0], array, idx); // left
        // center
        array[idx] = address(uint160(tree.value));
        ++idx;
        if (tree.neighbors[1].exists) idx = readInto(tree.neighbors[1], array, idx); // right
        return idx;
    }
}
