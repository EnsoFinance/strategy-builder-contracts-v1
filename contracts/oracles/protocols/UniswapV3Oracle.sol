//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import "../../interfaces/registries/IUniswapV3Registry.sol";
import "./ProtocolOracle.sol";

contract UniswapV3Oracle is ProtocolOracle {
    using SafeMath for uint256;

    address public immutable override weth;
    IUniswapV3Registry public immutable registry;

    constructor(address registry_, address weth_) {
        registry = IUniswapV3Registry(registry_);
        weth = weth_;
    }

    function consult(uint256 amount, address input) public view override returns (uint256) {
        if (input == weth || amount == 0) return amount;
        IUniswapV3Registry.PoolData memory poolData = registry.getPoolData(input);
        return _traversePairs(amount, input, poolData.pair, poolData.pool, registry.timeWindow());
    }

    function _traversePairs(
        uint256 amount,
        address token,
        address pair,
        address pool,
        uint32 timeWindow
    ) internal view returns (uint256){
        int24 tick = _getTick(pool, timeWindow);
        uint256 value = OracleLibrary.getQuoteAtTick(tick, uint128(amount), token, pair);
        if (pair != weth) {
            IUniswapV3Registry.PoolData memory poolData = registry.getPoolData(pair);
            value = _traversePairs(value, pair, poolData.pair, poolData.pool, timeWindow);
        }
        return value;
    }

    function _getRange(uint32 secondsAgo) internal pure returns (uint32[] memory) {
        uint32[] memory range = new uint32[](2);
        range[0] = secondsAgo;
        range[1] = 0;
        return range;
    }

    function _getTick(address pool, uint32 timeWindow) internal view returns (int24) {
      (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(_getRange(timeWindow));
      return int24((tickCumulatives[1] - tickCumulatives[0]) / timeWindow);
    }
}
