//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../libraries/SafeERC20.sol";
import "../../interfaces/yearn/IYEarnV2Vault.sol";
import "../../helpers/GasCostProvider.sol";
import "../BaseAdapter.sol";

contract YEarnV2Adapter is BaseAdapter {
    using SafeERC20 for IERC20;

    GasCostProvider public immutable gasCostProvider;

    constructor(address weth_) public BaseAdapter(weth_) {
        gasCostProvider = new GasCostProvider(9000, msg.sender);
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
        if (_checkVault(tokenOut)) {
            IYEarnV2Vault vault = IYEarnV2Vault(tokenOut);
            require(address(vault.token()) == tokenIn, "Incompatible");
            IERC20(tokenIn).safeApprove(tokenOut, amount);
            received = vault.deposit(amount, address(this));
        } else {
            IYEarnV2Vault vault = IYEarnV2Vault(tokenIn);
            require(address(vault.token()) == tokenOut, "Incompatible");
            received = vault.withdraw(amount, address(this), 1); // Default maxLoss is 1
        }

        require(received >= expected, "Insufficient tokenOut amount");

        if (to != address(this))
            IERC20(tokenOut).safeTransfer(to, received);
    }

    function _checkVault(address vault) internal view returns (bool) {
        bytes32 selector = keccak256("token()");
        uint256 gasCost = gasCostProvider.gasCost();

        bool success;
        address token;
        assembly {
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 32))
            mstore(ptr, selector)
            success := staticcall(
                gasCost,
                vault,
                ptr,
                4,
                ptr,
                32
            )
            token := mload(ptr)
        }
        return success && token != address(0);
    }
}
