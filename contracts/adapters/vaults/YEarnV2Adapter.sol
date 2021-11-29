//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../BaseAdapter.sol";
import "../../interfaces/yearn/IYEarnV2Vault.sol";
import "../../interfaces/IERC20NonStandard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract YEarnV2Adapter is BaseAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    constructor(address weth_) public BaseAdapter(weth_) {}

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        if (_checkVault(tokenOut)) {
            IYEarnV2Vault vault = IYEarnV2Vault(tokenOut);
            if (address(vault.token()) == tokenIn)
                return amount.mul(10**uint256(IERC20NonStandard(tokenIn).decimals())).div(vault.pricePerShare());
        } else if (_checkVault(tokenIn)) {
            IYEarnV2Vault vault = IYEarnV2Vault(tokenIn);
            if (address(vault.token()) == tokenOut)
                return amount.mul(vault.pricePerShare()).div(10**uint256(IERC20NonStandard(tokenOut).decimals()));
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
        if (_checkVault(tokenOut)) {
            IYEarnV2Vault vault = IYEarnV2Vault(tokenOut);
            require(address(vault.token()) == tokenIn, "Incompatible");
            IERC20(tokenIn).approve(tokenOut, amount);
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

        bool success;
        address token;
        assembly {
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 32))
            mstore(ptr, selector)
            success := staticcall(
                9000, //estimated gas costs
                vault,
                ptr,
                4,
                ptr,
                32
            )
            token := mload(ptr)
        }
        if (success && token != address(0)) return true;
        return false;
    }
}
