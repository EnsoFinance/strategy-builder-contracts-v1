//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/registries/IUniswapV3Registry.sol";
import "../interfaces/deprecated/IUniswapV3Registry_Deprecated.sol";

contract UniswapV3RegistryWrapper is IUniswapV3Registry {

    IUniswapV3Registry_Deprecated private immutable registry;
    uint32 private immutable timeWindow;

    constructor(address registry_) public {
        registry = IUniswapV3Registry_Deprecated(registry_);
        timeWindow = IUniswapV3Registry_Deprecated(registry_).timeWindow();
    }

    function batchAddPools(
        address[] memory tokens,
        address[] memory pairs,
        uint24[] memory fees,
        uint32[] memory timeWindows
    ) external override {
        (timeWindows);
        registry.batchAddPools(tokens, pairs, fees);
    }

    function batchAddFees(
        address[] memory tokens,
        address[] memory pairs,
        uint24[] memory fees
    ) external override {
        (tokens, pairs, fees);
    }

    function addPool(address token, address pair, uint24 fee, uint32 timeWindow) external override {
        (timeWindow);
        registry.addPool(token, pair, fee);
    }

    function removePool(address token) external override {
        registry.removePool(token);
    }

    function addFee(address token, address pair, uint24 fee) external override {
      (token, pair, fee);
    }

    function removeFee(address token, address pair) external override {
      (token, pair);
    }

    function getPoolData(address token) external view override returns (PoolData memory) {
        IUniswapV3Registry_Deprecated.PoolData memory poolData = registry.getPoolData(token);
        return PoolData(poolData.pool, poolData.pair, timeWindow);
    }

    function getFee(address token, address pair) external view override returns (uint24) {
        return registry.getFee(token, pair);
    }

    function getTimeWindow(address token, address pair) external view override returns (uint32) {
        return timeWindow;
    }

    function updateTimeWindow(address token, uint32 timeWindow) external {
        (token, timeWindow);
        revert();
    }

    function factory() external view override returns (IUniswapV3Factory) {
        return registry.factory();
    }

    function weth() external view override returns (address) {
        return registry.weth();
    }
}
