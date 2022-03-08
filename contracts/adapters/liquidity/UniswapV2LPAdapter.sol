//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "../../libraries/SafeERC20.sol";
import "../../libraries/UniswapV2Library.sol";
import "../../libraries/Math.sol";
import "../BaseAdapter.sol";

contract UniswapV2LPAdapter is BaseAdapter {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;

    uint256 private constant DEFAULT_AMOUNT = 10**9;
    uint256 private constant MINIMUM_LIQUIDITY = 10**3;
    address public immutable factory;

    constructor(address factory_, address weth_) public BaseAdapter(weth_) {
        factory = factory_;
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        if (tokenIn == weth) {
            IUniswapV2Pair pair = IUniswapV2Pair(tokenOut);
            address token0 = pair.token0();
            address token1 = pair.token1();
            uint256 totalSupply = pair.totalSupply();
            // TODO change to reflect `swap`'s logic
            (uint256 wethIn0, uint256 wethIn1) = _calculateWethAmounts(
                tokenOut,
                token0,
                token1,
                amount,
                totalSupply,
                true
            );
            uint256 amount0 = _quote(wethIn0, weth, token0);
            uint256 amount1 = _quote(wethIn1, weth, token1);
            if (totalSupply == 0) {
                return Math.sqrt(amount0.mul(amount1)).sub(MINIMUM_LIQUIDITY);
            } else {
                (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
                return Math.min(amount0.mul(totalSupply) / reserve0, amount1.mul(totalSupply) / reserve1);
            }
        } else if (tokenOut == weth) {
            IUniswapV2Pair pair = IUniswapV2Pair(tokenIn);
            address token0 = pair.token0();
            address token1 = pair.token1();
            uint256 totalSupply = pair.totalSupply();
            uint256 amount0 = amount.mul(IERC20(token0).balanceOf(tokenIn)) / totalSupply;
            uint256 amount1 = amount.mul(IERC20(token1).balanceOf(tokenIn)) / totalSupply;
            uint256 wethAmount0 = _quote(amount0, token0, weth);
            uint256 wethAmount1 = _quote(amount1, token1, weth);
            return wethAmount0.add(wethAmount1);
        } else {
            return 0;
        }
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
        if (tokenIn == weth) {
            if (from != address(this))
                IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            IUniswapV2Pair pair = IUniswapV2Pair(tokenOut);
            address otherToken;
            { // stack too deep
            address token0 = pair.token0();
            address token1 = pair.token1();
            otherToken = (token0 == weth) ? token1 : token0;
            }
            uint256 wethToSell = _calculateWethToSell(amount, otherToken);
            // Swap weth for underlying tokens
            uint256 otherTokenBought = _buyToken(wethToSell, otherToken);
            // Transfer underyling token to pair contract
            IERC20(weth).safeTransfer(tokenOut, amount.sub(wethToSell));
            IERC20(otherToken).safeTransfer(tokenOut, otherTokenBought);
            uint256 received = pair.mint(to);
            require(received >= expected, "Insufficient tokenOut amount");
        } else if (tokenOut == weth) {
            // Send liquidity to the token contract
            if (from != address(this)) {
                IERC20(tokenIn).safeTransferFrom(from, tokenIn, amount);
            } else {
                IERC20(tokenIn).safeTransfer(tokenIn, amount);
            }
            IUniswapV2Pair pair = IUniswapV2Pair(tokenIn);
            address token0 = pair.token0();
            address token1 = pair.token1();
            // Burn liquidity and get back underlying tokens
            (uint256 amount0, uint256 amount1) = pair.burn(address(this));
            uint256 wethAmount0 = _sellToken(amount0, token0, to);
            uint256 wethAmount1 = _sellToken(amount1, token1, to);
            require(wethAmount0.add(wethAmount1) >= expected, "Insufficient tokenOut amount");
        } else {
            revert("Token not supported");
        }
    }

    function _calculateWethToSell(uint256 uAmount, address otherToken) private returns(uint256) {
      (uint256 uReserveWeth, uint256 uReserveOther) = UniswapV2Library.getReserves(factory, weth, otherToken);
      int256 amount = int256(uAmount);
      int256 reserveWeth = int256(uReserveWeth);
      int256 reserveOther = int256(uReserveOther);

      /**

       we build a quadratic 
       f(x) = ax^2 + bx + c

       Algebraic justification:
       
        For the Uniswap mint, we want amount0/reserve0 == amount1/reserve1 since the liquidity is the min of these two expressions.
       Given an amount a of weth we wish to find wethToSell+fees x so that we get the above equality.
        Said with these variables, we want
        (a-x)/r0 == getAmountOut(x)/r1
        where getAmountOut(x) = 997r1'x/(1000r0' + 997x) 
        see https://github.com/Uniswap/v2-periphery/blob/2efa12e0f2d808d9b49737927f0e416fafa5af68/contracts/libraries/UniswapV2Library.sol#L43
        Keep in mind that the r0 at the mint can be expressed as the reserve before the swap r0' as r0 = r0'+x.
        Similarly we write r1 = r1'-getAmountOut(x)
        From the equation we get a quadratic where
        a = -997r1'
        b = -1997r0'r1' 
        c = 1000r0'r1'a

      */

      int256 a = int256(-997).mul(reserveOther); // FIXME normalize 
      int256 b = int256(-1997).mul(reserveWeth).mul(reserveOther); // FIXME normalize
      int256 c = int256(1000).mul(reserveWeth).mul(reserveOther).mul(amount); // FIXME normalize

      // we find the roots simply using the quadratic formula

      int256 d = b.mul(b).sub(int256(4).mul(a).mul(c));
      require(d >= 0, "_calculateWethToSell: solution imaginary.");
      int256 center = -b;
      uint256 sqrt = Math.sqrt(uint256(d));
      int256 denominator = int256(2).mul(a);
      int256 solution = center.sub(int256(sqrt)).div(denominator);
      if (0<solution && solution<amount)
        return uint256(solution);
      solution = center.add(int256(sqrt)).div(denominator);
      require(0<solution && solution<amount, "_caluculateWethToSell: solution out of range.");
      return uint256(solution);
    }

    function _calculateWethAmounts(address pair, address token0, address token1, uint256 amount, uint256 totalSupply, bool quote) internal view returns (uint256, uint256) {
        // Calculate the amount of weth needed to purchase underlying tokens
        uint256 amountIn0 = _getAmountIn(token0, pair, totalSupply, quote);
        uint256 amountIn1 = _getAmountIn(token1, pair, totalSupply, quote);
        uint256 wethDivisor = amountIn0.add(amountIn1);
        uint256 wethIn0 = amount.mul(amountIn0).div(wethDivisor);
        uint256 wethIn1 = amount.sub(wethIn0);
        return (wethIn0, wethIn1);
    }

    function _getAmountIn(address token, address pair, uint256 totalSupply, bool quote) internal view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(pair);
        uint256 amountOut = DEFAULT_AMOUNT.mul(balance) / totalSupply;
        if (token == weth) return amountOut;
        (uint256 wethReserve, uint256 tokenReserve) = UniswapV2Library.getReserves(factory, weth, token);
        if (quote) {
            return UniswapV2Library.quote(amountOut, tokenReserve, wethReserve);
        } else {
            return UniswapV2Library.getAmountIn(amountOut, wethReserve, tokenReserve);
        }
    }

    function _buyToken(
        uint256 amountIn,
        address token
    ) internal returns (uint256) {
        if (token == weth) return amountIn;
        (uint256 reserveIn, uint256 reserveOut) = UniswapV2Library.getReserves(factory, weth, token);
        uint256 amountOut = UniswapV2Library.getAmountOut(amountIn, reserveIn, reserveOut);
        (address token0, ) = UniswapV2Library.sortTokens(weth, token);
        (uint256 amount0Out, uint256 amount1Out) =
            token == token0 ? (amountOut, uint256(0)) : (uint256(0), amountOut);
        address pair = UniswapV2Library.pairFor(factory, weth, token);
        IERC20(weth).safeTransfer(pair, amountIn);
        IUniswapV2Pair(pair).swap(
            amount0Out,
            amount1Out,
            address(this),
            new bytes(0)
        );
        return amountOut;
    }

    function _sellToken(uint256 amountIn, address token, address to) internal returns (uint256) {
        if (token == weth) {
            IERC20(token).transfer(to, amountIn);
            return amountIn;
        }
        (uint256 reserveIn, uint256 reserveOut) = UniswapV2Library.getReserves(factory, token, weth);
        uint256 amountOut = UniswapV2Library.getAmountOut(amountIn, reserveIn, reserveOut);
        (address token0, ) = UniswapV2Library.sortTokens(weth, token);
        (uint256 amount0Out, uint256 amount1Out) =
            token == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
        address pair = UniswapV2Library.pairFor(factory, weth, token);
        IERC20(token).safeTransfer(pair, amountIn);
        IUniswapV2Pair(pair).swap(
            amount0Out,
            amount1Out,
            to,
            new bytes(0)
        );
        return amountOut;
    }

    function _quote(uint256 amount, address tokenIn, address tokenOut) internal view returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        (uint256 reserveIn, uint256 reserveOut) = UniswapV2Library.getReserves(factory, tokenIn, tokenOut);
        return UniswapV2Library.quote(amount, reserveIn, reserveOut);
    }
}
