//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStakedEnso {
    function enso() external view returns(IERC20 enso);
    function boostModifier(uint128 amount, uint32 stakeHours) external view returns(uint256 boost);
    function maxHours() external view returns(uint32);
}