//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

library BinaryTreeWithPayload {

    struct Tree {
        bool exists;
        uint256 value;
        bytes payload;
        Tree[] neighbors; // 0-parent, 1-left, 2-right
    }

    function newNode(uint256 value, bytes memory payload) internal returns(Tree memory) {
        Tree memory tree;
        tree.exists = true;
        tree.value = value;
        tree.payload = payload;
        tree.neighbors = new Tree[](3);
        return tree;
    }

    function newNode() internal returns(Tree memory) {
        Tree memory tree;
        tree.neighbors = new Tree[](3);
        return tree;
    }

    function newNode(Tree memory parent, uint256 value, bytes memory payload) internal returns(Tree memory) {
        Tree memory tree;
        tree.exists = true;
        tree.value = value;
        tree.payload = payload;
        tree.neighbors = new Tree[](3);
        tree.neighbors[0] = parent;
        return tree;
    }

    function add(Tree memory tree, uint256 value, bytes memory payload) internal {
        if (!tree.exists) {
            tree.exists = true;
            tree.value = value;
            tree.payload = payload;
            return;
	}
        uint256 idx = 1; // left
        if (tree.value < value) idx = 2; // right
        if (tree.neighbors[idx].exists) {
            add(tree.neighbors[idx], value, payload);
        } else {
            tree.neighbors[idx] = newNode(tree, value, payload); 
        }
    }

    function readInto(Tree memory tree, uint256[] memory arrayA, uint256[] memory arrayB) internal {
        if (tree.neighbors[1].exists) readInto(tree.neighbors[1], arrayA, arrayB); // left
        // center
        uint256 idx = arrayA[arrayA.length-1];
        arrayA[idx] = tree.value;
        (uint256 decoded) = abi.decode(tree.payload, (uint256));
        arrayB[idx] = decoded;
        idx++;
        arrayA[arrayA.length-1] = idx;
        if (tree.neighbors[2].exists) readInto(tree.neighbors[2], arrayA, arrayB); // right
    }
}
