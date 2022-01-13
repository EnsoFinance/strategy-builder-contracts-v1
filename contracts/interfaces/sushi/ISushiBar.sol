// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISushiBar is IERC20 {
    function sushi() external view returns (address);
    
    function enter(uint256 _amount) external;

    function leave(uint256 _share) external;
}
