//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "../../libraries/SafeERC20.sol";
import "../../interfaces/registries/IUniswapV3Registry.sol";
import "../../interfaces/uniswap/ISwapRouter.sol";
import "../BaseAdapter.sol";

contract UniswapV3Adapter is BaseAdapter {
    using SafeERC20 for IERC20;

    IUniswapV3Registry public immutable registry;
    ISwapRouter public immutable router;

    constructor(address registry_, address router_, address weth_) BaseAdapter(weth_) {
        registry = IUniswapV3Registry(registry_);
        router = ISwapRouter(router_);
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
        uint24 fee = registry.getFee(tokenIn, tokenOut);
        require(fee > 0, "Pair fee not registered");
        IERC20(tokenIn).safeApprove(address(router), amount);
        router.exactInputSingle(ISwapRouter.ExactInputSingleParams(
            tokenIn,
            tokenOut,
            fee,
            to,
            block.timestamp,
            amount,
            expected,
            0
        ));
        require(IERC20(tokenIn).allowance(address(this), address(router)) == 0, "Incomplete swap");
    }
}
