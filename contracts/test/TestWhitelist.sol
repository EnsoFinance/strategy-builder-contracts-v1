//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "../interfaces/IWhitelist.sol";


contract TestWhitelist is IWhitelist {
    mapping(address => bool) internal _approvals;

    function approve(address account) external override {
        _approvals[account] = true;
    }

    function revoke(address account) external override {
        delete _approvals[account];
    }

    function approved(address account) external view override returns (bool) {
        return _approvals[account];
    }
}
