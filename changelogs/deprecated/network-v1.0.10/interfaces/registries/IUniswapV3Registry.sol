//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";

interface IUniswapV3Registry {

  struct FeeData {
      uint24 fee;
      address pair;
  }

  struct PoolData {
      address pool;
      address pair;
  }

  function batchAddPools(
      address[] memory tokens,
      address[] memory pairs,
      uint24[] memory fees
  ) external;

  function addPool(address token, address pair, uint24 fee) external;

  function removePool(address token) external;

  function getPoolData(address token) external view returns (PoolData memory);

  function getFee(address token, address pair) external view returns (uint24);

  function weth() external view returns (address);

  function factory() external view returns (IUniswapV3Factory);

  function timeWindow() external view returns (uint32);
}
