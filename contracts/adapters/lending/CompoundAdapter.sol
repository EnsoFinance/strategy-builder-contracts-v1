//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../libraries/SafeERC20.sol";
import "../../interfaces/IRewardsAdapter.sol";
import "../../interfaces/compound/ICToken.sol";
import "../../interfaces/compound/IComptroller.sol";
import "../../helpers/GasCostProvider.sol";
import "../ProtocolAdapter.sol";

contract CompoundAdapter is ProtocolAdapter, IRewardsAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IComptroller public immutable comptroller;

    constructor(
      address comptroller_,
      address weth_,
      address tokenRegistry_,
      uint256 categoryIndex_
    ) public ProtocolAdapter(weth_, tokenRegistry_, categoryIndex_) {
        comptroller = IComptroller(comptroller_);
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

        if (_checkToken(tokenOut)) {
            ICToken cToken = ICToken(tokenOut);
            require(cToken.underlying() == tokenIn, "Incompatible");
            IERC20(tokenIn).safeApprove(tokenOut, amount);
            cToken.mint(amount);
        } else {
            require(_checkToken(tokenIn), "No Compound token");
            ICToken cToken = ICToken(tokenIn);
            require(cToken.underlying() == tokenOut, "Incompatible");
            cToken.redeem(amount);
        }
        uint256 received = IERC20(tokenOut).balanceOf(address(this));
        require(received >= expected, "Insufficient tokenOut amount");

        if (to != address(this))
            IERC20(tokenOut).safeTransfer(to, received);
    }

    // Intended to be called via delegateCall
    function claim(address[] memory tokens) external override {
        comptroller.claimComp(address(this), tokens);
    }

    // Intended to be called via delegateCall
    /*function claim(address token) external override {
        require(_checkToken(token), "Not claimable");
        address[] memory tokens = new address[](1);
        tokens[0] = token;
        comptroller.claimComp(address(this), tokens);
    }*/
}
