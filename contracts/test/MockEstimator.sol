//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../interfaces/IReserveEstimator.sol";

interface IMockProtocol {
    function balances(address) external view returns (uint256);
}

contract MockEstimator is IReserveEstimator {

    address public immutable mockProtocol;

    constructor(address mockProtocol_) public {
      mockProtocol = mockProtocol_;
    }

    function estimateItem(uint256 balance, address item) public view override returns (int256) {
        if (item == mockProtocol) return int256(balance);
        return 0;
    }

    function getBalance(address account, address item) public view override returns (uint256) {
        return IMockProtocol(item).balances(account);
    }
}
