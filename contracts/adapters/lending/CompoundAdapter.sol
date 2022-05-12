//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../libraries/SafeERC20.sol";
import "../../interfaces/IRewardsAdapter.sol";
import "../../interfaces/compound/ICToken.sol";
import "../../interfaces/compound/IComptroller.sol";
import "../../helpers/GasCostProvider.sol";
import "../BaseAdapter.sol";

contract CompoundAdapter is BaseAdapter, IRewardsAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IComptroller public immutable comptroller;
    GasCostProvider public immutable gasCostProvider;

    constructor(address comptroller_, address weth_) public BaseAdapter(weth_) {
        comptroller = IComptroller(comptroller_);
        gasCostProvider = new GasCostProvider(400, msg.sender);
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

        if (_checkCToken(tokenOut)) {
            ICToken cToken = ICToken(tokenOut);
            require(cToken.underlying() == tokenIn, "Incompatible");
            IERC20(tokenIn).safeApprove(tokenOut, amount);
            cToken.mint(amount);
        } else {
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
    function claim(address token) external override {
        address[] memory tokens = new address[](1);
        tokens[0] = token;
        comptroller.claimComp(address(this), tokens);
    }

    function _checkCToken(address token) internal view returns (bool) {
        bytes32 selector = keccak256("isCToken()");
        uint256 gasCost = gasCostProvider.gasCost();

        bool success;
        bool isCToken;
        assembly {
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 32))
            mstore(ptr, selector)
            success := staticcall(
                gasCost,
                token,
                ptr,
                4,
                ptr,
                32
            )
            isCToken := mload(ptr)
        }
        return success && isCToken;
    }
}
