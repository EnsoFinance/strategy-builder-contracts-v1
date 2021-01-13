// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

contract Portfolio {
    address public owner;
    address public oracle;
    address public whitelist;
    string public name;
    string public symbol;
    uint256 public version;
    address[] public tokens;
    uint256[] public percentages;

    constructor(
        address _owner,
        address _oracle,
        address _whitelist,
        string memory _name,
        string memory _symbol,
        uint256 _version,
        address[] memory _tokens,
        uint256[] memory _percentages
    ) public {
        owner = _owner;
        oracle = _oracle;
        whitelist = _whitelist;
        name = _name;
        symbol = _symbol;
        version = _version;
        tokens = _tokens;
        percentages = _percentages;
    }
}
