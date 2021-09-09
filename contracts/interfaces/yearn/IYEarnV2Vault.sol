// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IYEarnV2Vault {

  function token() external view returns (IERC20);

  function pricePerShare() external view returns (uint256);

  function decimals() external view returns (uint256);

  function totalSupply() external view returns (uint256);

  function totalAssets() external view returns (uint256);

  function deposit(uint256 _amount, address recipient) external returns (uint256);

  function withdraw(uint256 maxShares, address recipient, uint256 maxLoss) external returns (uint256);

}
