//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../BaseAdapter.sol";
import "../../interfaces/sushi/ISushiBar.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract SushiBarAdapter is BaseAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public constant sushi = IERC20(0x6B3595068778DD592e39A122f4f5a5cF09C90fE2);
    ISushiBar public constant xsushi = ISushiBar(0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272);

    constructor(address weth_) public BaseAdapter(weth_) {}

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        if (tokenIn == address(sushi)) {
            uint256 totalSushi = sushi.balanceOf(address(xsushi));
            uint256 totalShares = xsushi.totalSupply();
            if (totalShares == 0 || totalSushi == 0) return amount;
            return amount.mul(totalShares).div(totalSushi);
        } else if (tokenIn == address(xsushi)) {
          uint256 totalShares = xsushi.totalSupply();
          return amount.mul(sushi.balanceOf(address(xsushi))).div(totalShares);
        }
        return 0;
    }

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
        uint256 received;
        if (tokenIn == address(sushi)) {
            sushi.safeApprove(address(xsushi), amount);
            xsushi.enter(amount);
        } else if (tokenIn == address(xsushi)) {
            xsushi.leave(amount);
        } else {
            revert();
        }
        IERC20(tokenOut).balanceOf(address(this));
        require(received >= expected, "Insufficient tokenOut amount");
        if (to != address(this))
            IERC20(tokenOut).safeTransfer(to, received);
    }
}
