// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.6.0 <0.9.0;

interface IAToken {
    function POOL() external view returns (address);

    function UNDERLYING_ASSET_ADDRESS() external view returns (address);

    function approveDelegation(address delegatee, uint256 amount) external;

    function borrowAllowance(address fromUser, address toUser) external view returns (uint256);
}
