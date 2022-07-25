//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../libraries/AddressArrays.sol";
import "../libraries/BinaryTreeWithPayload.sol";

contract TestBinaryTree {

    function fuzzAddressArrayReadInto() external {
        address[] memory arr = new address[](20); 
        BinaryTree.Tree memory tree = BinaryTree.newNode();
        address addrs;
        for (uint256 i; i < arr.length; ++i) {
            addrs = address(uint256(keccak256(abi.encode(i))));
            BinaryTree.add(tree, uint256(uint160(addrs)));
        }
        address[] memory res = new address[](arr.length);
        AddressArrays.readInto(tree, res, 0);
        for (uint256 i; i < res.length; ++i) {
            // ignorantly find in arr 
            if (i < res.length - 1) {
                require(res[i] > res[i + 1], "result not ordered."); 
            }
            for (uint256 j; j < arr.length; ++j) {
                if (res[i] == arr[j]) { // found!
                    arr[j] = address(0); 
                    break;
                } 
            }
        }
        // validate all res was found in arr
        for (uint256 i; i < arr.length; ++i) {
            require(arr[i] == address(0), "not all found."); 
        }
    }

    function fuzzBinaryTreeWithPayloadReadInto() external {
        uint256[] memory arr = new uint256[](20); 
        BinaryTreeWithPayload.Tree memory tree = BinaryTreeWithPayload.newNode();
        uint256 value;
        for (uint256 i; i < arr.length; ++i) {
            value = uint256(keccak256(abi.encode(i)));
            BinaryTreeWithPayload.add(tree, value, new bytes(0));
        }
        uint256[] memory res = new uint256[](arr.length);
        bytes[] memory vals = new bytes[](arr.length);
        BinaryTreeWithPayload.readInto(tree, res, vals);
        for (uint256 i; i < res.length - 1; ++i) {
            // ignorantly find in arr 
            if (i < res.length - 2) {
                require(res[i] > res[i + 1], "result not ordered."); 
            }
            for (uint256 j; j < arr.length; ++j) {
                if (res[i] == arr[j]) { // found!
                    arr[j] = 0; 
                    break;
                } 
            }
        }
        // validate all res was found in arr
        for (uint256 i; i < arr.length; ++i) {
            require(arr[i] == 0, "not all found."); 
        }
    }
}
