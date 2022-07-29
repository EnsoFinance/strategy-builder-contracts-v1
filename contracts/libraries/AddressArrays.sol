//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.6.12;

import "./BinaryTree.sol";

library AddressArrays {
    using BinaryTree for BinaryTree.Tree;

    // @notice Returns all values from array0 and array1 (without duplicates)
    function with(address[] calldata array0, address[] calldata array1) internal view returns (address[] memory result) {
        BinaryTree.Tree memory tree = BinaryTree.newNode();
        uint256 count;
        uint256 length = array0.length;
        for (uint256 i; i < length; ++i) {
            if (tree.replace(uint256(uint160(array0[i])))) ++count;
        }
        length = array1.length;
        for (uint256 i; i < length; ++i) {
            if (tree.replace(uint256(uint160(array1[i])))) ++count;
        }
        if (count != 0) {
            result = new address[](count);
            readInto(tree, result, 0);
        }
    }

    // @notice Returns all values in array0 that are not also in array1
    function without(address[] memory array0, address[] calldata array1) internal view returns (address[] memory result) {
        BinaryTree.Tree memory tree1 = BinaryTree.newNode();
        uint256 length = array1.length;
        for (uint256 i; i < length; ++i) {
            tree1.push(uint256(uint160(array1[i])));
        }
        BinaryTree.Tree memory tree0 = BinaryTree.newNode();
        uint256 count;
        length = array0.length;
        for (uint256 i; i < length; ++i) {
            uint256 key = uint256(uint160(array0[i]));
            // If key is found in tree1, don't include it in tree0
            if (!tree1.get(key).exists) {
                tree0.push(key);
                ++count;
            }
        }
        if (count != 0) {
            result = new address[](count);
            readInto(tree0, result, 0);
        }
    }

    function readInto(BinaryTree.Tree memory tree, address[] memory array, uint256 idx) internal pure returns (uint256) {
        if (tree.neighbors[0].exists) idx = readInto(tree.neighbors[0], array, idx); // left
        // center
        array[idx] = address(uint160(tree.value));
        ++idx;
        if (tree.neighbors[1].exists) idx = readInto(tree.neighbors[1], array, idx); // right
        return idx;
    }
}
