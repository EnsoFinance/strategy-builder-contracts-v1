//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./ExchangeAdapter.sol";
import "../interfaces/curve/ICurveDeposit.sol";
import "../interfaces/curve/ICurveStableSwap.sol";
import "../interfaces/curve/ICurvePoolRegistry.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract CurveLPAdapter is ExchangeAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    ICurvePoolRegistry public immutable curveRegistry;

    constructor(
        address curveRegistry_,
        address weth_
    ) public ExchangeAdapter(weth_) {
        curveRegistry = ICurvePoolRegistry(curveRegistry_);
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        if (curveRegistry.swapContracts(tokenOut) != address(0)) {
            ICurveStableSwap swapContract = ICurveStableSwap(curveRegistry.swapContracts(tokenOut));
            if (curveRegistry.coinsInPool(tokenOut) == 2) {
                uint256[2] memory depositAmounts;
                depositAmounts[curveRegistry.coinIndexes(tokenOut, tokenIn)] = amount;
                return swapContract.calc_token_amount(depositAmounts, true);
            }
            if (curveRegistry.coinsInPool(tokenOut) == 3) {
                uint256[3] memory depositAmounts;
                depositAmounts[curveRegistry.coinIndexes(tokenOut, tokenIn)] = amount;
                return swapContract.calc_token_amount(depositAmounts, true);
            }
            if (curveRegistry.coinsInPool(tokenOut) == 4) {
                uint256[4] memory depositAmounts;
                depositAmounts[curveRegistry.coinIndexes(tokenOut, tokenIn)] = amount;
                return swapContract.calc_token_amount(depositAmounts, true);
            }
        } else if (curveRegistry.depositContracts(tokenIn) != address(0)) {
            ICurveDeposit depositContract = ICurveDeposit(curveRegistry.depositContracts(tokenIn));
            uint256 index = curveRegistry.coinIndexes(tokenIn, tokenOut);
            return depositContract.calc_withdraw_one_coin(amount, int128(index));
        } else {
          return 0;
        }
    }

    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override returns (bool) {
        require(tokenIn != tokenOut, "Tokens cannot match");
        if (from != address(this))
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);

        if (curveRegistry.swapContracts(tokenOut) != address(0)) {
            ICurveStableSwap swapContract = ICurveStableSwap(curveRegistry.swapContracts(tokenOut));
            IERC20(tokenIn).safeApprove(address(swapContract), amount);
            if (curveRegistry.coinsInPool(tokenOut) == 2) {
                uint256[2] memory depositAmounts;
                depositAmounts[curveRegistry.coinIndexes(tokenOut, tokenIn)] = amount;
                swapContract.add_liquidity(depositAmounts, 0);
            }
            if (curveRegistry.coinsInPool(tokenOut) == 3) {
                uint256[3] memory depositAmounts;
                depositAmounts[curveRegistry.coinIndexes(tokenOut, tokenIn)] = amount;
                swapContract.add_liquidity(depositAmounts, 0);
            }
            if (curveRegistry.coinsInPool(tokenOut) == 4) {
                uint256[4] memory depositAmounts;
                depositAmounts[curveRegistry.coinIndexes(tokenOut, tokenIn)] = amount;
                swapContract.add_liquidity(depositAmounts, 0);
            }
        } else {
            ICurveDeposit depositContract = ICurveDeposit(curveRegistry.depositContracts(tokenIn));
            uint256 index = curveRegistry.coinIndexes(tokenIn, tokenOut);
            IERC20(tokenIn).approve(address(depositContract), amount);
            depositContract.remove_liquidity_one_coin(amount, int128(index), 1);
        }
        uint256 received = IERC20(tokenOut).balanceOf(address(this));
        require(received >= expected, "Insufficient tokenOut amount");
        if (to != address(this))
            IERC20(tokenOut).safeTransfer(to, received);
        return true;
    }
}
