//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

interface IUniswapV3Registry {
  function addFee(uint24 fee) external;

  function initialize(address input) external;

  function weth() external view returns (address);

  function factory() external view returns (IUniswapV3Factory);

  function timeWindow() external view returns (uint32);

  function defaultFee() external view returns (uint24);

  function fees(uint256 index) external view returns (uint24);

  function pools(address token) external view returns (address);

  function poolFees(address token) external view returns (uint24);

  function getPool(address tokenIn, address tokenOut) external view returns (IUniswapV3Pool);

  function getRange(uint32 secondsAgo) external pure returns (uint32[] memory);
}
