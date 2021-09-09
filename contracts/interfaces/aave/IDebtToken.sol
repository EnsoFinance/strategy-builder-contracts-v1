// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.6.0 <0.9.0;

interface IDebtToken {
    function POOL() external view returns (address);

    function UNDERLYING_ASSET_ADDRESS() external view returns (address);

    function scaledBalanceOf(address user) external view returns (uint256);

    function getScaledUserBalanceAndSupply(address user) external view returns (uint256, uint256);

    function scaledTotalSupply() external view returns (uint256);

    function borrowAllowance(address fromUser, address toUser) external view returns(uint256);

    function approveDelegation(address delegatee, uint256 amount) external;

}
