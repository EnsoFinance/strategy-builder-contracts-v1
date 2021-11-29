//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import "../../interfaces/registries/IUniswapV3Registry.sol";
import "./ProtocolOracle.sol";

contract UniswapV3Oracle is ProtocolOracle {
    using SafeMath for uint256;

    address public override weth;
    IUniswapV3Registry public registry;

    constructor(address registry_) {
        registry = IUniswapV3Registry(registry_);
        weth = registry.weth();
    }

    function consult(uint256 amount, address input) public view override returns (uint256) {
        if (input == weth) return amount;
        if (amount == 0) return 0;

        IUniswapV3PoolDerivedState pool = registry.getPool(input, weth);

        (int56[] memory tickCumulatives, ) = pool.observe(registry.getRange(registry.timeWindow()));
        int24 tick = int24((tickCumulatives[1] - tickCumulatives[0]) / registry.timeWindow());

        return OracleLibrary.getQuoteAtTick(tick, uint128(amount), input, weth);
    }
}
