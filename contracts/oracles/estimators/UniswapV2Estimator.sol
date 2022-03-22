//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../libraries/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";

contract UniswapV2Estimator is IEstimator {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    // Reason for two values: When one token value is larger than another, depending
    // on the order, dividing produces a number greater than or less than 1.
    // e.g. If two values (90 and 100), 90/100 = 0.9, 100/90 = 1.010101. The deviation
    // from 1 changes based on the order. Which is reflected in our different thresholds
    uint256 public constant MAX_PRICE_DEVIATION_ABOVE = 111111111111111111; // 11.111%
    uint256 public constant MAX_PRICE_DEVIATION_BELOW = 100000000000000000; // 10%

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        return int256(balance).mul(_latestAnswer(IUniswapV2Pair(token))).div(10**18);
    }

    // The following code is adapted from Aave's UniswapV2PriceProvider
    // https://etherscan.io/address/0x66A6b87A18DB78086acda75b7720DC47CdABcC05

    /**
     * @dev Returns the pair's token price.
     *   It calculates the price using Enso oracle as an external price source and the pair's tokens reserves using the arithmetic mean formula.
     *   If there is a price deviation, instead of the reserves, it uses a weighted geometric mean with constant invariant K.
     * @return int256 price
     */
    function _latestAnswer(IUniswapV2Pair pair) internal view returns (int256) {
        //Get token reserves in ethers
        (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
        address token0 = pair.token0();
        address token1 = pair.token1();
        uint256 ethTotal0 = uint256(IOracle(msg.sender).estimateItem(uint256(reserve0), token0));
        uint256 ethTotal1 = uint256(IOracle(msg.sender).estimateItem(uint256(reserve1), token1));
        // Revert if the deviation is too extreme. Likely price manipulation.
        require(!_hasDeviation(ethTotal0, ethTotal1), "Price deviation");
        // Calculate the mean
        return int256(_getArithmeticMean(pair, ethTotal0, ethTotal1));

    }

    /**
     * Returns true if there is a price deviation.
     * @param ethTotal0 Total eth for token 0.
     * @param ethTotal1 Total eth for token 1.
     */
    function _hasDeviation(uint256 ethTotal0, uint256 ethTotal1)
        internal
        pure
        returns (bool)
    {
        //Check for a price deviation
        uint256 price_deviation = Math.bdiv(ethTotal0, ethTotal1);
        if (
            price_deviation > (Math.BONE.add(MAX_PRICE_DEVIATION_ABOVE)) ||
            price_deviation < (Math.BONE.sub(MAX_PRICE_DEVIATION_BELOW))
        ) {
            return true;
        }
        return false;
    }

    /**
     * Calculates the price of the pair token using the formula of arithmetic mean.
     * @param ethTotal0 Total eth for token 0.
     * @param ethTotal1 Total eth for token 1.
     */
    function _getArithmeticMean(IUniswapV2Pair pair, uint256 ethTotal0, uint256 ethTotal1)
        internal
        view
        returns (uint256)
    {
        uint256 totalEth = ethTotal0 + ethTotal1;
        return Math.bdiv(totalEth, _getTotalSupplyAtWithdrawal(pair));
    }

    /**
     * Calculates the price of the pair token using the formula of weighted geometric mean.
     * @param ethTotal0 Total eth for token 0.
     * @param ethTotal1 Total eth for token 1.
     */
    function _getWeightedGeometricMean(IUniswapV2Pair pair, uint256 ethTotal0, uint256 ethTotal1)
        internal
        view
        returns (uint256)
    {
        uint256 square = Math.bsqrt(Math.bmul(ethTotal0, ethTotal1), true);
        return
            Math.bdiv(
                Math.bmul(Math.TWO_BONES, square),
                _getTotalSupplyAtWithdrawal(pair)
            );
    }

    /**
     * Returns Uniswap V2 pair total supply at the time of withdrawal.
     */
    function _getTotalSupplyAtWithdrawal(IUniswapV2Pair pair)
        private
        view
        returns (uint256 totalSupply)
    {
        totalSupply = pair.totalSupply();
        address feeTo =
            IUniswapV2Factory(pair.factory()).feeTo();
        bool feeOn = feeTo != address(0);
        if (feeOn) {
            uint256 kLast = pair.kLast();
            if (kLast != 0) {
                (uint112 reserve_0, uint112 reserve_1, ) = pair.getReserves();
                uint256 rootK =
                    Math.bsqrt(uint256(reserve_0).mul(reserve_1), false);
                uint256 rootKLast = Math.bsqrt(kLast, false);
                if (rootK > rootKLast) {
                    uint256 numerator = totalSupply.mul(rootK.sub(rootKLast));
                    uint256 denominator = rootK.mul(5).add(rootKLast);
                    uint256 liquidity = numerator / denominator;
                    totalSupply = totalSupply.add(liquidity);
                }
            }
        }
    }

    function estimateItem(address user, address token) public view override returns (int256) { 
        revert("estimateItem: address parameter not supported.");
    }
}
