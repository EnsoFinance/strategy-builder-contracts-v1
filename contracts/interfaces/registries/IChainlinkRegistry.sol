//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

interface IChainlinkRegistry {

      event OracleChange(address indexed token, address indexed pair, address indexed oracle, bool inverse, bool addOrDelete); // true for add

      struct ChainlinkOracleData {
          address oracle;
          address pair;
          bool inverse;
      }

      function getOracle(address token) external view returns (ChainlinkOracleData memory);

      function batchAddOracles(
          address[] memory tokens,
          address[] memory pairs,
          address[] memory oracles,
          bool[] memory inverse
      ) external;

      function addOracle(address token, address pair, address oracle, bool inverse) external;

      function removeOracle(address token) external;
}
