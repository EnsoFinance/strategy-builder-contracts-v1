//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../BaseAdapter.sol";
import "../../interfaces/IRewardsAdapter.sol";
import "../../interfaces/compound/ICToken.sol";
import "../../interfaces/compound/IComptroller.sol";
import "../../interfaces/IERC20NonStandard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract CompoundAdapter is BaseAdapter, IRewardsAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IComptroller public immutable comptroller;

    constructor(address comptroller_, address weth_) public BaseAdapter(weth_) {
        comptroller = IComptroller(comptroller_);
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        if (_checkCToken(tokenOut)) {
            ICToken cToken = ICToken(tokenOut);
            if (cToken.underlying() == tokenIn)
                return amount.mul(10**uint256(IERC20NonStandard(tokenIn).decimals())).div(cToken.exchangeRateStored());
        } else if (_checkCToken(tokenIn)) {
            ICToken cToken = ICToken(tokenIn);
            if (cToken.underlying() == tokenOut)
                return amount.mul(cToken.exchangeRateStored()).div(10**uint256(IERC20NonStandard(tokenOut).decimals()));
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

        if (_checkCToken(tokenOut)) {
            ICToken cToken = ICToken(tokenOut);
            require(cToken.underlying() == tokenIn, "Incompatible");
            IERC20(tokenIn).approve(tokenOut, amount);
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
    function claim(address token) public override {
        address[] memory tokens = new address[](1);
        tokens[0] = token;
        comptroller.claimComp(address(this), tokens);
    }

    function _checkCToken(address token) internal view returns (bool) {
        bytes32 selector = keccak256("isCToken()");

        bool success;
        assembly {
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 32))
            mstore(ptr, selector)
            success := staticcall(
                400, //estimated gas costs
                token,
                ptr,
                4,
                ptr,
                32
            )
        }
        return success;
    }
}
