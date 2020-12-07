// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract Portfolio is IERC20 {
    address public creator;

    struct Item {
        address token;
        uint256 split;
    }

    constructor(address _creator) public {
        creator = _creator;
    }

    modifier onlyCreator() {
        require(creator == msg.sender, 'Caller is not the creator');
        _;
    }

    function setup(address[] calldata tokens, uint256[] calldata split) external payable onlyCreator {
        revert('Not yet implemented');
    }

    function rebalance() public {
        revert();
    }

    function totalSupply() external view override returns (uint256) {
        revert();
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        revert();
    }

    function deposit() public payable {
        //onlySocialTrading
        revert();
    }

    function withdraw(uint256 amount) public {
        //this.transferFrom(msg.sender, this, amount);
        //burn();
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        revert();
    }

    function balanceOf(address account) external view override returns (uint256) {
        revert();
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        revert();
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external override returns (bool) {
        revert();
    }
}
