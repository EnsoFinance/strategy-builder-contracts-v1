//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface IRewardsAdapter {
    function rewardsTokens(address token) external returns(address[] memory);
 
    // FIXME delete
    function claim(address token) external;

    function claim(address[] memory rewardsTokens, address[] memory tokens) external;
}
