//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

interface IStrategyApprovals {
    function approveToken(
        address token,
        address account,
        uint256 amount
    ) external;

    function approveTokens(
        address[] memory tokens,
        address account,
        uint256 amount
    ) external;

    function approveDebt(
        address[] memory tokens,
        address account,
        uint256 amount
    ) external;

    function approveSynths(
        address account,
        uint256 amount
    ) external;
}
