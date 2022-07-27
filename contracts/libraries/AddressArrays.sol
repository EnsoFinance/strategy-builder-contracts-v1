//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;

import "./BinaryTree.sol";

library AddressArrays {
    using BinaryTree for BinaryTree.Tree;

    // @notice Returns all values from array0 and array1 (without duplicates)
    function with(address[] calldata array0, address[] calldata array1) internal view returns (address[] memory result) {
        BinaryTree.Tree memory tree = BinaryTree.newNode();
        uint256 count;
        for (uint256 i; i < array0.length; ++i) {
            if (tree.replace(uint256(uint160(array0[i])))) count++;
        }
        for (uint256 i; i < array1.length; ++i) {
            if (tree.replace(uint256(uint160(array1[i])))) count++;
        }
        if (count != 0) {
            result = new address[](count);
            readInto(tree, result, 0);
        }
    }

    // @notice Returns all values in array0 that are not also in array1
    function without(address[] memory array0, address[] calldata array1) internal view returns (address[] memory result) {
        BinaryTree.Tree memory tree1 = BinaryTree.newNode();
        for (uint256 i; i < array1.length; ++i) {
            tree1.add(uint256(uint160(array1[i])));
        }
        BinaryTree.Tree memory tree0 = BinaryTree.newNode();
        uint256 count;
        for (uint256 i; i < array0.length; ++i) {
            uint256 key = uint256(uint160(array0[i]));
            // If key is found in tree1, don't include it in tree0
            if (!tree1.get(key).exists) {
                tree0.add(key);
                count++;
            }
        }
        if (count != 0) {
            result = new address[](count);
            readInto(tree0, result, 0);
        }
    }

    function readInto(BinaryTree.Tree memory tree, address[] memory array, uint256 idx) internal view returns (uint256) {
        if (tree.neighbors[0].exists) idx = readInto(tree.neighbors[0], array, idx); // left
        // center
        array[idx] = address(uint160(tree.value));
        ++idx;
        if (tree.neighbors[1].exists) idx = readInto(tree.neighbors[1], array, idx); // right
        return idx;
    }
}
