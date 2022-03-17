//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "./IEstimator.sol";

interface IReserveEstimator is IEstimator {
    function getBalance(
        address account,
        address item
    ) external view returns (uint256);
}
