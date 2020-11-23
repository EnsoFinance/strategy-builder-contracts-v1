// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Portfolio is IERC20 {
    address public creator;

    struct Item {
        address token;
        uint split;
    }

    constructor(address _creator) public {
        creator = _creator;
    }

    modifier onlyCreator() {
        require(creator == msg.sender, "Caller is not the creator");
        _;
    }

    function setup(address [] calldata tokens, uint [] calldata split) payable external onlyCreator {
        revert('Not yet implemented');
    }

    function rebalance() public {
        revert();
    }

    function totalSupply() override external view returns (uint256) {
        revert();
    }

    function allowance(address owner, address spender) override external view returns (uint256) {
        revert();
    }

    function approve(address spender, uint256 amount) override external returns (bool) {
        revert();
    }

    function balanceOf(address account) override external view returns (uint256) {
        revert();
    }

    function transfer(address recipient, uint256 amount) override external returns (bool) {
        revert();
    }

    function transferFrom(address sender, address recipient, uint256 amount) override external returns (bool) {
        revert();
    }
}

