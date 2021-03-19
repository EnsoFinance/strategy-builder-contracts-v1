//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./ExchangeAdapter.sol";
import "../libraries/UniswapV2Library.sol";

contract UniswapAdapter is ExchangeAdapter {
    using SafeMath for uint256;

    address internal _factory;

    constructor(address factory_, address weth_) public ExchangeAdapter(weth_) {
        _factory = factory_;
        _package = abi.encode(factory_);
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        (uint256 reserveA, uint256 reserveB) =
            UniswapV2Library.getReserves(_factory, tokenIn, tokenOut);
        return UniswapV2Library.quote(amount, reserveA, reserveB);
    }

    function swapPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        return UniswapV2Library.getAmountsOut(_factory, amount, path)[1];
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
        address to,
        bytes memory data,
        bytes memory package
    ) public override returns (bool) {
        require(tokenIn != tokenOut, "Tokens cannot match");
        // For delegate call must pass state in with 'package' parameters.
        // If package.length == 0 just rely on regular state
        (address factoryAddress) =
            package.length > 0 ? abi.decode(package, (address)) : (_factory);

        TransferHelper.safeTransferFrom(
            tokenIn,
            from,
            UniswapV2Library.pairFor(factoryAddress, tokenIn, tokenOut),
            amount
        );
        (uint256 reserveIn, uint256 reserveOut) = UniswapV2Library.getReserves(factoryAddress, tokenIn, tokenOut);
        uint256 received = UniswapV2Library.getAmountOut(amount, reserveIn, reserveOut);
        require(received >= expected, "Insufficient tokenOut amount");
        _pairSwap(factoryAddress, 0, received, tokenIn, tokenOut, to, data);
        return true;
    }

    function _pairSwap(
        address factory,
        uint256 tokenAOut,
        uint256 tokenBOut,
        address tokenA,
        address tokenB,
        address to,
        bytes memory data
    ) internal {
        (address token0, ) = UniswapV2Library.sortTokens(tokenA, tokenB);
        (uint256 amount0Out, uint256 amount1Out) =
            tokenA == token0 ? (tokenAOut, tokenBOut) : (tokenBOut, tokenAOut);
        IUniswapV2Pair(UniswapV2Library.pairFor(factory, tokenA, tokenB)).swap(
            amount0Out,
            amount1Out,
            to,
            data
        );
    }
}
