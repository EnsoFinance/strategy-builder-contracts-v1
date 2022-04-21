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

    address public immutable factory;

    constructor(address factory_, address weth_) public BaseAdapter(weth_) {
        factory = factory_;
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
            IUniswapV2Pair pair = IUniswapV2Pair(tokenOut); // FIXME how is this tokens[1]??? in test?
            if (pair.token0() == weth || pair.token1() == weth) {
                _transferWethIntoWethPair(amount, pair);
            } else {
                _transferWethIntoPair(amount, pair);
            }
            uint256 received = pair.mint(to);
            require(received >= expected, "Insufficient tokenOut amount");
        } else if (tokenOut == weth) {
            // Send liquidity to the token contract
            if (from != address(this)) {
                IERC20(tokenIn).safeTransferFrom(from, tokenIn, amount);
            } else {
                IERC20(tokenIn).safeTransfer(tokenIn, amount);
            }
            IUniswapV2Pair pair = IUniswapV2Pair(tokenIn); // FIXME!!! this looks suss
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

    function _calculateWethAmounts(
        address pair,
        address tokenA,
        address tokenB,
        uint256 amount
    ) internal view returns (uint256, uint256) {
        (uint256 rA, uint256 rB) = UniswapV2Library.getReserves(factory, tokenA, tokenB);
        if (rA==rB) {
            rB += 1; // prevents div by zero error and makes approximation off negligibly
        }
        int256 B;
        int256 C;
        { // stack too deep !!!
            (uint256 r_wa, uint256 r_a) = UniswapV2Library.getReserves(factory, weth, tokenA);
            (uint256 r_wb, uint256 r_b) = UniswapV2Library.getReserves(factory, weth, tokenB);

            // this next fn was needed for "stack too deep" shenanigans
            B = _getBForCalculateWethAmounts(amount, rA, rB, r_wa, r_a, r_wb, r_b);

            C = int256(rA.mul(r_wa).mul(amount).mul(uint256(1000))).div(
              int256(997).mul(int256(r_a)).mul(int256(rB)-int256(rA))
            ); 
        }
        int256 solution;
        { // stack too deep !!!
            int256 d = B.mul(B).sub(int256(4).mul(C));
            require(d >= 0, "_calculateWethAmounts: solution imaginary.");
            int256 center = -B;
            uint256 sqrt = Math.sqrt(uint256(d));
            solution = center.add(int256(sqrt)).div(2);
            if (!(0 < solution && solution < int256(amount))){
                solution = center.sub(int256(sqrt)).div(2);
                require(0 < solution && solution < int256(amount), "_calculateWethAmounts: solution out of range.");
            }
        }
        uint256 uSolution = uint256(solution);
        (uint256 wethInA, uint256 wethInB) = (uSolution, amount.sub(uSolution));
        return (wethInA, wethInB);
    }

    function _getBForCalculateWethAmounts(uint256 amount, uint256 rA, uint256 rB, uint256 r_wa, uint256 r_a, uint256 r_wb, uint256 r_b) private pure returns(int256) {
        // Stack too deep + SafeMath forces us to break down the arithmetic below.
        int256 numerator = int256(rA.mul(r_b).mul(r_wa).add(rB.mul(r_a).mul(r_wb))).mul(int256(1000));
        int256 commonFactor = int256(997).mul(int256(r_a.mul(r_b)).mul(int256(rA)-int256(rB)));
        numerator = numerator.sub(commonFactor.mul(int256(amount)));
        return numerator / commonFactor;
    }

    function _buyToken(
        uint256 amountIn,
        address token
    ) internal returns (uint256) {
        // we assume token != weth
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

    function _sellToken(
        uint256 amountIn,
        address token,
        address to
    ) internal returns (uint256) {
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

    function _transferWethIntoWethPair(uint256 amount, IUniswapV2Pair pair) private {
        // assumes calling function checks one of the tokens is weth
        address token0 = pair.token0();
        address token1 = pair.token1();
        address otherToken = (token0 == weth) ? token1 : token0;
        uint256 wethToSell = _calculateWethToSell(amount, otherToken);
        // Swap weth for underlying tokens
        uint256 otherTokenBought = _buyToken(wethToSell, otherToken);
        // Transfer underyling token to pair contract
        IERC20(weth).safeTransfer(address(pair), amount.sub(wethToSell));
        IERC20(otherToken).safeTransfer(address(pair), otherTokenBought);
        /*
          At this point lp minting should be efficient, meaning that the difference of
          amount0*totalSupply/reserve0 and amount1*totalSupply/reserve1 is negligible.
          Keep in mind however that this mechanism hasn't been fully analyzed with
          respect to tokens that charge a fee on transfer or rebasing tokens.
         */
    }

    function _transferWethIntoPair(uint256 amount, IUniswapV2Pair pair) private {
        // assumes calling function checks one of the tokens is not weth
        address token0 = pair.token0();
        address token1 = pair.token1();
        (uint256 wethIn0, uint256 wethIn1) = _calculateWethAmounts(
                address(pair),
                token0,
                token1,
                amount
            );
        // Swap weth for underlying tokens
        uint256 amountOut0 = _buyToken(wethIn0, token0);
        uint256 amountOut1 = _buyToken(wethIn1, token1);
        // Transfer underyling token to pair contract
        IERC20(token0).safeTransfer(address(pair), amountOut0);
        IERC20(token1).safeTransfer(address(pair), amountOut1);
    }

    function _calculateWethToSell(uint256 uAmount, address otherToken) private view returns(uint256) {
        (uint256 uReserveWeth,) = UniswapV2Library.getReserves(factory, weth, otherToken);
        int256 amount = int256(uAmount);
        int256 reserveWeth = int256(uReserveWeth);

        /*
          we build a quadratic
          f(x) = ax^2 + bx + c

          Algebraic justification:

          For the Uniswap mint, we want amount0/reserve0 == amount1/reserve1 since the liquidity is the min of these two expressions times totalSupply.
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

          but instead of writing ax^2 + bx + c we write x^2 + Bx + C where B=b/a and C=c/a
          to reduce chance of overflow

          B = 1997r0'/997
          C = -1000r0'a/997
        */

        int256 B = reserveWeth.mul(1997).div(int256(997));
        int256 C = int256(-1000).mul(reserveWeth).mul(amount).div(int256(997));

        // we find the roots simply using the quadratic formula

        int256 d = B.mul(B).sub(int256(4).mul(C));

        require(d >= 0, "_calculateWethToSell: solution imaginary.");
        int256 center = -B;
        uint256 sqrt = Math.sqrt(uint256(d));

        int256 denominator = int256(2);
        int256 solution = center.add(int256(sqrt)).div(denominator);
        if (0 < solution && solution < amount)
            return uint256(solution);
        solution = center.sub(int256(sqrt)).div(denominator);
        require(0 < solution && solution < amount, "_calculateWethToSell: solution out of range.");
        return uint256(solution);
    }
}
