//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface ICurvePoolRegistry {
    function depositContracts(address token) external view returns (address);

    function swapContracts(address token) external view returns (address);

    function gaugeContracts(address token) external view returns (address);

    function coinsInPool(address token) external view returns (uint256);

    function coins(address token, uint256 index) external view returns (address);

    function coinIndexes(address token, address underlying) external view returns (uint256);

    function exchanges(address tokenIn, address tokenOut) external view returns (address);
}
