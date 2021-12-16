//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "../BaseAdapter.sol";
import "../../interfaces/registries/IUniswapV3Registry.sol";
import "../../interfaces/uniswap/ISwapRouter.sol";

contract UniswapV3Adapter is BaseAdapter {
    using SafeMath for uint256;
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
        uint24 fee = registry.getFee(tokenIn, tokenOut);
        address pool = factory.getPool(
          tokenIn,
          tokenOut,
          fee > 0 ? fee : registry.defaultFee()
        );
        if (pool != address(0)) {
            (uint160 sqrtPriceX96,,,,,,) =  IUniswapV3Pool(pool).slot0();
            uint256 ratio = uint256(sqrtPriceX96).mul(uint256(sqrtPriceX96)).mul(10**18) >> (96 * 2);
            if (tokenIn > tokenOut) {
                return amount.mul(10**18).div(ratio);
            } else {
                return amount.mul(ratio).div(10**18);
            }
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
        uint24 fee = registry.getFee(tokenIn, tokenOut);
        router.exactInputSingle(ISwapRouter.ExactInputSingleParams(
            tokenIn,
            tokenOut,
            fee > 0 ? fee : registry.defaultFee(),
            to,
            block.timestamp,
            amount,
            expected,
            0
        ));
    }
}
