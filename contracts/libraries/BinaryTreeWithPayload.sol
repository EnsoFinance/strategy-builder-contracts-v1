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

    function add(Tree memory tree, uint256 value, bytes memory payload) internal pure {
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

    function replace(Tree memory tree, uint256 value, bytes memory payload) internal pure {
        if (!tree.exists) {
            tree.exists = true;
            tree.value = value;
            tree.payload = payload;
            return;
        }
        if (tree.value == value) {
            tree.payload = payload;
            return;
        }
        uint256 idx = 0;
        if (tree.value > value) idx = 1;
        if (tree.neighbors[idx].exists) {
            replace(tree.neighbors[idx], value, payload);
        } else {
            tree.neighbors[idx] = newNode(value, payload); 
        }
    }

    function get(Tree memory tree, uint256 value) internal pure returns(Tree memory) {
        if (!tree.exists || tree.value == value) return tree;
        uint256 idx;
        if (tree.value > value) idx = 1;
        return get(tree.neighbors[idx], value);
    }

    function readInto(Tree memory tree, uint256[] memory arrayA, bytes[] memory arrayB) internal pure { 
        if (arrayA.length != arrayB.length+1) revert("readInto: arrayA needs idx entry.");
        if (arrayB.length == 0) revert("readInto: arrayB can't be length 0.");
        _readInto(tree, arrayA, arrayB);
    }

    function readInto(Tree memory tree, uint256[] memory arrayA, uint256[] memory arrayB) private pure { 
        if (arrayA.length != arrayB.length+1) revert("readInto: arrayA needs idx entry.");
        if (arrayB.length == 0) revert("readInto: arrayB can't be length 0.");
        _readInto(tree, arrayA, arrayB);
    }

    function _readInto(Tree memory tree, uint256[] memory arrayA, bytes[] memory arrayB) private pure { 
        if (tree.neighbors[0].exists) _readInto(tree.neighbors[0], arrayA, arrayB); // left
        // center
        uint256 idx = arrayA[arrayA.length-1];
        arrayA[idx] = tree.value;
        arrayB[idx] = tree.payload;
        arrayA[arrayA.length-1] = ++idx;
        if (tree.neighbors[1].exists) _readInto(tree.neighbors[1], arrayA, arrayB); // right
    }

    function _readInto(Tree memory tree, uint256[] memory arrayA, uint256[] memory arrayB) private pure { 
        if (tree.neighbors[0].exists) _readInto(tree.neighbors[0], arrayA, arrayB); // left
        // center
        uint256 idx = arrayA[arrayA.length-1];
        arrayA[idx] = tree.value;
        arrayB[idx] = abi.decode(tree.payload, (uint256));
        arrayA[arrayA.length-1] = ++idx;
        if (tree.neighbors[1].exists) _readInto(tree.neighbors[1], arrayA, arrayB); // right
    }
}
