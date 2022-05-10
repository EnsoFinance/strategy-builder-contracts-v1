//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/lens/Quoter.sol";
import "../../libraries/SafeERC20.sol";
import "../../interfaces/registries/IUniswapV3Registry.sol";
import "../../interfaces/uniswap/ISwapRouter.sol";
import "../BaseAdapter.sol";

contract UniswapV3Adapter is BaseAdapter {
    using SafeERC20 for IERC20;

    IUniswapV3Registry public immutable registry;
    ISwapRouter public immutable router;
    address private immutable _uniswapV3Quoter;


    constructor(address registry_, address router_, address weth_) BaseAdapter(weth_) {
        registry = IUniswapV3Registry(registry_);
        router = ISwapRouter(router_);
        _uniswapV3Quoter = 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6;
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

    function estimateSwap(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) public view override returns(uint256) {
        require(tokenIn != tokenOut, "Tokens cannot match");
        uint24 fee = registry.getFee(tokenIn, tokenOut);
        require(fee > 0, "Pair fee not registered");
        //return _uniswapV3Quoter.quoteExactInputSingle(tokenIn, tokenOut, fee, amount, 0);
        bytes memory data = abi.encodeWithSelector(
            bytes4(keccak256("quoteExactInputSingle(address,address,uint24,uint256,uint160)")),
            tokenIn,
            tokenOut,
            fee,
            amount,
            0
        );
        (bool success, bytes memory res) = _uniswapV3Quoter.staticcall(data);
        if (!success) {
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
        return abi.decode(res, (uint256));
    }
}
