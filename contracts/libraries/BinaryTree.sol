//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

library BinaryTree {

    struct Tree {
        bool exists;
        uint256 value; // sort by value in descending order max -> min
        Tree[] neighbors; // 0-left, 1-right
    }

    function newNode() internal pure returns(Tree memory) {
        Tree memory tree;
        tree.neighbors = new Tree[](2);
        return tree;
    }

    function newNode(uint256 value) internal pure returns(Tree memory) {
        Tree memory tree;
        tree.exists = true;
        tree.value = value;
        tree.neighbors = new Tree[](2);
        return tree;
    }

    function push(Tree memory tree, uint256 value) internal pure {
        if (!tree.exists) {
            tree.exists = true;
            tree.value = value;
            return;
        }
        if (tree.value == value) {
            return;
        }
        uint256 idx;
        if (tree.value > value) idx = 1;
        if (tree.neighbors[idx].exists) {
            push(tree.neighbors[idx], value);
        } else {
            tree.neighbors[idx] = newNode(value); 
        }
    }

    function replace(Tree memory tree, uint256 value) internal pure returns(bool) {
        if (!tree.exists) {
            tree.exists = true;
            tree.value = value;
            return true;
        }
        if (tree.value == value) {
            return false;
        }
        uint256 idx;
        if (tree.value > value) idx = 1;
        if (tree.neighbors[idx].exists) {
            return replace(tree.neighbors[idx], value);
        } else {
            tree.neighbors[idx] = newNode(value); 
            return true;
        }
    }

    function get(Tree memory tree, uint256 value) internal pure returns(Tree memory) {
        if (!tree.exists || tree.value == value) return tree;
        uint256 idx;
        if (tree.value > value) idx = 1;
        return get(tree.neighbors[idx], value);
    }

    function readInto(Tree memory tree, uint256[] memory array) internal pure { 
        if (array.length == 0) revert("readInto: array.length == 0.");
        _readInto(tree, array, 0);
    }

    function _readInto(Tree memory tree, uint256[] memory array, uint256 idx) private pure returns(uint256) { 
        if (tree.neighbors[0].exists) idx = _readInto(tree.neighbors[0], array, idx); // left
        // center
        array[idx] = tree.value;
        ++idx;
        if (tree.neighbors[1].exists) idx = _readInto(tree.neighbors[1], array, idx); // right
        return idx;
    }
}
