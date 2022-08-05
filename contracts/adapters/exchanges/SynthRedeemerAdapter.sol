//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/SafeERC20.sol";
import "../../interfaces/synthetix/ISynthRedeemer.sol";
import "../BaseAdapter.sol";

contract SynthRedeemerAdapter is BaseAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    ISynthRedeemer public immutable redeemer;
    address public immutable susd;

    constructor(
        address redeemer_,
        address susd_,
        address weth_
    ) public BaseAdapter(weth_) {
        redeemer = ISynthRedeemer(redeemer_);
        susd = susd_;
    }

    // Note: Since redeemable tokens are not transferrable this function can only be called via delegate call
    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
        require(tokenIn != tokenOut, "Tokens cannot match");
        require(from == address(this), "Cannot transfer from another address");
        require(tokenOut == susd, "Can only redeem to sSUSD");
        uint256 beforeBalance = IERC20(tokenOut).balanceOf(address(this));
        redeemer.redeemPartial(IERC20(tokenIn), amount);
        uint256 afterBalance = IERC20(tokenOut).balanceOf(address(this));
        uint256 received = afterBalance.sub(beforeBalance);
        require(received >= expected, "Insufficient tokenOut amount");
        if (to != address(this))
            IERC20(tokenIn).safeTransfer(to, amount);
    }
}
