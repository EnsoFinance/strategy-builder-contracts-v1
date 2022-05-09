//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

library BinaryTreeWithPayload {

    struct Tree {
        bool exists;
        uint256 value; // sort by value in descending order max -> min
        bytes payload; // optional arbitrary payload
        Tree[] neighbors; // 0-left, 1-right
    }

    function newNode() internal returns(Tree memory) {
        Tree memory tree;
        tree.neighbors = new Tree[](2);
        return tree;
    }

    function newNode(uint256 value, bytes memory payload) internal returns(Tree memory) {
        Tree memory tree;
        tree.exists = true;
        tree.value = value;
        tree.payload = payload;
        tree.neighbors = new Tree[](2);
        return tree;
    }

    function add(Tree memory tree, uint256 value, bytes memory payload) internal {
        if (!tree.exists) {
            tree.exists = true;
            tree.value = value;
            tree.payload = payload;
            return;
	}
        uint256 idx = 0;
        if (tree.value > value) idx = 1;
        if (tree.neighbors[idx].exists) {
            add(tree.neighbors[idx], value, payload);
        } else {
            tree.neighbors[idx] = newNode(value, payload); 
        }
    }

    function readInto(Tree memory tree, uint256[] memory arrayA, uint256[] memory arrayB) internal {
        if (tree.neighbors[0].exists) readInto(tree.neighbors[0], arrayA, arrayB); // left
        // center
        uint256 idx = arrayA[arrayA.length-1];
        arrayA[idx] = tree.value;
        arrayB[idx] = abi.decode(tree.payload, (uint256));
        ++idx;
        arrayA[arrayA.length-1] = idx;
        if (tree.neighbors[1].exists) readInto(tree.neighbors[1], arrayA, arrayB); // right
    }
}
