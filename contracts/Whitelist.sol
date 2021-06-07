//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IWhitelist.sol";

contract Whitelist is IWhitelist, Ownable {
    mapping(address => bool) internal _approvals;

    function approve(address account) external override onlyOwner {
        require(!_approvals[account], "Already whitelisted");
        _approvals[account] = true;
    }

    function revoke(address account) external override onlyOwner {
        require(_approvals[account], "Not whitelisted");
        delete _approvals[account];
    }

    function approved(address account) external view override returns (bool) {
        return _approvals[account];
    }
}
