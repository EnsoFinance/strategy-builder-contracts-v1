//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface IStaking {
    function stakeFor(
        address user,
        uint128 amount
    ) external;

    function redeemFor(
        address user,
        uint128 amount
    ) external;

    function claim(address token) external returns(uint256 owed);
}
