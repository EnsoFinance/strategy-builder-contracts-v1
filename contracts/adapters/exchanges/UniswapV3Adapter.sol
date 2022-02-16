//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import "../../libraries/SafeERC20.sol";
import "../../interfaces/registries/IUniswapV3Registry.sol";
import "../../interfaces/uniswap/ISwapRouter.sol";
import "../BaseAdapter.sol";

contract UniswapV3Adapter is BaseAdapter {
    using SafeERC20 for IERC20;

    IUniswapV3Factory public immutable factory;
    IUniswapV3Registry public immutable registry;
    ISwapRouter public immutable router;

    constructor(address registry_, address factory_, address router_, address weth_) public BaseAdapter(weth_) {
        registry = IUniswapV3Registry(registry_);
        factory = IUniswapV3Factory(factory_);
        router = ISwapRouter(router_);

    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        address pool = factory.getPool(
          tokenIn,
          tokenOut,
          registry.getFee(tokenIn, tokenOut)
        );
        if (pool != address(0)) {
            ( , int24 tick, , , , , ) =  IUniswapV3Pool(pool).slot0();
            return OracleLibrary.getQuoteAtTick(tick, uint128(amount), tokenIn, tokenOut);
        }
        return 0;
    }

    /*
     * WARNING: This function can be called by anyone! Never approve this contract
     * to transfer your tokens. It should only ever be called by a contract which
     * approves an exact token amount and immediately swaps the tokens OR is used
     * in a delegate call where this contract NEVER gets approved to transfer tokens.
     */
    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
        require(tokenIn != tokenOut, "Tokens cannot match");
        if (from != address(this))
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
        IERC20(tokenIn).safeApprove(address(router), amount);
        router.exactInputSingle(ISwapRouter.ExactInputSingleParams(
            tokenIn,
            tokenOut,
            registry.getFee(tokenIn, tokenOut),
            to,
            block.timestamp,
            amount,
            expected,
            0
        ));
    }
}
