//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

interface IStrategyProxyFactory {
    function implementation() external view returns (address);

    function controller() external view returns (address);

    function oracle() external view returns (address);

    function whitelist() external view returns (address);

    function version() external view returns (uint256);
}
