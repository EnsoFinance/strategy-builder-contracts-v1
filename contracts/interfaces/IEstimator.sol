//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "./IStrategy.sol";

interface IEstimator {

    function estimateItem(
        IStrategy strategy,
        address token
    ) external view returns (int256);

    function estimateItem(
        IStrategy strategy,
        address token,
        uint256 balance
    ) external view returns (int256);
}

interface IEstimatorKnowing {
    function estimateItem(
        IStrategy strategy,
        address token,
        address underlyingToken,
        uint256 balance
    ) external view returns (int256);
}
