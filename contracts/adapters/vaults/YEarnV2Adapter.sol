//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../libraries/SafeERC20.sol";
import "../../interfaces/yearn/IYEarnV2Vault.sol";
import "../ProtocolAdapter.sol";

contract YEarnV2Adapter is ProtocolAdapter {
    using SafeERC20 for IERC20;

    constructor(
      address weth_,
      address tokenRegistry_,
      uint256 categoryIndex_
    ) public ProtocolAdapter(weth_, tokenRegistry_, categoryIndex_) {}

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
        if (_checkToken(tokenOut)) {
            IYEarnV2Vault vault = IYEarnV2Vault(tokenOut);
            require(address(vault.token()) == tokenIn, "Incompatible");
            IERC20(tokenIn).safeApprove(tokenOut, amount);
            received = vault.deposit(amount, address(this));
        } else {
            require(_checkToken(tokenIn), "No YEarn token");
            IYEarnV2Vault vault = IYEarnV2Vault(tokenIn);
            require(address(vault.token()) == tokenOut, "Incompatible");
            received = vault.withdraw(amount, address(this), 1); // Default maxLoss is 1
        }

        require(received >= expected, "Insufficient tokenOut amount");

        if (to != address(this))
            IERC20(tokenOut).safeTransfer(to, received);
    }
}
