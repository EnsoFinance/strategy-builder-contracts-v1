//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";

interface IUniswapV3Registry {

    event PoolAdded(address indexed token, address indexed pair, uint24 indexed fee, uint32 timeWindow);
     
    event PoolRemoved(address indexed token);

    event TimeWindowUpdated(address indexed token, uint32 indexed timeWindow);

    struct PairData {
        address pair;
        uint24 fee;
        uint32 timeWindow;
    }

    struct PoolData {
        address pool;
        address pair;
        uint32 timeWindow;
    }

    function batchAddPools(
        address[] memory tokens,
        address[] memory pairs,
        uint24[] memory fees,
        uint32[] memory timeWindows
    ) external;

    function addPool(address token, address pair, uint24 fee, uint32 timeWindow) external;

    function removePool(address token) external;

    function getPoolData(address token) external view returns (PoolData memory);

    function getFee(address token, address pair) external view returns (uint24);

    function getTimeWindow(address token, address pair) external view returns (uint32);

    function weth() external view returns (address);

    function factory() external view returns (IUniswapV3Factory);
}
