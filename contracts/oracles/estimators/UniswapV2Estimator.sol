//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";

contract UniswapV2Estimator is IEstimator {
    using SignedSafeMath for int256;

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        int256 totalSupply = int256(IERC20(token).totalSupply());
        address token0 = IUniswapV2Pair(token).token0();
        address token1 = IUniswapV2Pair(token).token1();
        int256 token0Value = IOracle(msg.sender).estimateItem(IERC20(token0).balanceOf(token), token0);
        int256 token1Value = IOracle(msg.sender).estimateItem(IERC20(token1).balanceOf(token), token1);
        return token0Value.add(token1Value).mul(int256(balance)).div(totalSupply);
    }
}
