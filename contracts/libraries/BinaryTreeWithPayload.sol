//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

library BinaryTreeWithPayload {

    struct Tree {
        bool exists;
        uint256 value; // sort by value in descending order max -> min
        bytes payload; // optional arbitrary payload
        Tree[] neighbors; // 0-left, 1-right
    }

    function newNode() internal pure returns(Tree memory) {
        Tree memory tree;
        tree.neighbors = new Tree[](2);
        return tree;
    }

    function newNode(uint256 value, bytes memory payload) internal pure returns(Tree memory) {
        Tree memory tree;
        tree.exists = true;
        tree.value = value;
        tree.payload = payload;
        tree.neighbors = new Tree[](2);
        return tree;
    }

    function push(Tree memory tree, uint256 value, bytes memory payload) internal pure {
        if (!tree.exists) {
            tree.exists = true;
            tree.value = value;
            tree.payload = payload;
            return;
        }
        if (tree.value == value) {
            // Overwrite payload 
            tree.payload = payload;
            return;
        }
        uint256 idx = 0;
        if (tree.value > value) idx = 1;
        if (tree.neighbors[idx].exists) {
            push(tree.neighbors[idx], value, payload);
        } else {
            tree.neighbors[idx] = newNode(value, payload); 
        }
    }

    function replace(Tree memory tree, uint256 value, bytes memory payload) internal pure returns(bool) {
        if (!tree.exists) {
            tree.exists = true;
            tree.value = value;
            tree.payload = payload;
            return true;
        }
        if (tree.value == value) {
            tree.payload = payload;
            return false;
        }
        uint256 idx = 0;
        if (tree.value > value) idx = 1;
        if (tree.neighbors[idx].exists) {
            return replace(tree.neighbors[idx], value, payload);
        } else {
            tree.neighbors[idx] = newNode(value, payload); 
            return true;
        }
    }

    function get(Tree memory tree, uint256 value) internal pure returns(Tree memory) {
        if (!tree.exists || tree.value == value) return tree;
        uint256 idx;
        if (tree.value > value) idx = 1;
        return get(tree.neighbors[idx], value);
    }

    function readInto(Tree memory tree, uint256[] memory arrayA, bytes[] memory arrayB) internal pure { 
        if (arrayA.length != arrayB.length) revert("readInto: arrayA needs idx entry.");
        if (arrayB.length == 0) revert("readInto: arrayB can't be length 0.");
        _readInto(tree, arrayA, arrayB, 0);
    }

    function readInto(Tree memory tree, uint256[] memory arrayA, uint256[] memory arrayB) private pure { 
        if (arrayA.length != arrayB.length) revert("readInto: array lengths must match.");
        if (arrayB.length == 0) revert("readInto: arrays can't be length 0.");
        _readInto(tree, arrayA, arrayB, 0);
    }

    function _readInto(Tree memory tree, uint256[] memory arrayA, bytes[] memory arrayB, uint256 idx) private pure returns(uint256) { 
        if (tree.neighbors[0].exists) idx = _readInto(tree.neighbors[0], arrayA, arrayB, idx); // left
        // center
        arrayA[idx] = tree.value;
        arrayB[idx] = tree.payload;
        ++idx;
        if (tree.neighbors[1].exists) idx = _readInto(tree.neighbors[1], arrayA, arrayB, idx); // right
        return idx;
    }

    function _readInto(Tree memory tree, uint256[] memory arrayA, uint256[] memory arrayB, uint256 idx) private pure returns(uint256) { 
        if (tree.neighbors[0].exists) idx = _readInto(tree.neighbors[0], arrayA, arrayB, idx); // left
        // center
        arrayA[idx] = tree.value;
        arrayB[idx] = abi.decode(tree.payload, (uint256));
        ++idx;
        if (tree.neighbors[1].exists) idx = _readInto(tree.neighbors[1], arrayA, arrayB, idx); // right
        return idx;
    }
}
