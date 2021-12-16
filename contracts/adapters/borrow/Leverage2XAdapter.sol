//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/SafeERC20.sol";
import "../../interfaces/aave/IAToken.sol";
import "../BaseAdapter.sol";

contract Leverage2XAdapter is BaseAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable defaultAdapter;
    address public immutable aaveLendAdapter;
    address public immutable aaveBorrowAdapter;
    address public immutable debtToken; // Token that is being borrowed against collateral

    constructor(
        address defaultAdapter_,
        address aaveLendAdapter_,
        address aaveBorrowAdapter_,
        address debtToken_,
        address weth_
    ) public BaseAdapter(weth_) {
        defaultAdapter = defaultAdapter_;
        aaveLendAdapter = aaveLendAdapter_;
        aaveBorrowAdapter = aaveBorrowAdapter_;
        debtToken = debtToken_;
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        (tokenIn, tokenOut); // Assume correct tokens are submitted
        if (_checkAToken(tokenOut)) {
          return amount.mul(2);
        } else {
          return 0;
        }
    }

    // Swap to support 2X leverage called from generic router
    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
        require(tokenIn != tokenOut, "Tokens cannot match");
        require(amount >= expected, "Insufficient tokenOut amount");

        if (from != address(this))
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);

        require(_checkAToken(tokenOut), "Only supports deposit");
        require(IAToken(tokenOut).UNDERLYING_ASSET_ADDRESS() == tokenIn, "Incompatible");
        // Lend all underlying tokens (Amount received will equal amount sent)
        _delegateSwap(aaveLendAdapter, amount, 1, tokenIn, tokenOut, address(this), to);
        //Take out equivalent of 50% debt
        _delegateSwap(aaveBorrowAdapter, amount.div(2), 1, address(0), debtToken, to, address(this));
        //Trade debt for underlying
        _delegateSwap(defaultAdapter, IERC20(debtToken).balanceOf(address(this)), 1, debtToken, tokenIn, address(this), address(this));
        // Lend all underlying tokens
        _delegateSwap(aaveLendAdapter, IERC20(tokenIn).balanceOf(address(this)), 1, tokenIn, tokenOut, address(this), to);
        //Take out equivalent of 50% debt (should be able to borrow another 50% since we've added to our reserve)
        _delegateSwap(aaveBorrowAdapter, amount.div(2), 1, address(0), debtToken, to, address(this));
        //Trade debt for underlying
        _delegateSwap(defaultAdapter, IERC20(debtToken).balanceOf(address(this)), 1, debtToken, tokenIn, address(this), address(this));
        // Lend all underlying tokens
        _delegateSwap(aaveLendAdapter, IERC20(tokenIn).balanceOf(address(this)), expected, tokenIn, tokenOut, address(this), to);
    }

    function _delegateSwap(
        address adapter,
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) internal {
        //No need to check adapters since they are set at time of deployment and can't be changed
        bool success;
        bytes memory swapData =
            abi.encodeWithSelector(
                bytes4(
                    keccak256("swap(uint256,uint256,address,address,address,address)")
                ),
                amount,
                expected,
                tokenIn,
                tokenOut,
                from,
                to
            );
        uint256 txGas = gasleft();
        assembly {
            success := delegatecall(txGas, adapter, add(swapData, 0x20), mload(swapData), 0, 0)
        }
        require(success, "Swap failed");
    }

    function _checkAToken(address token) internal view returns (bool) {
        bytes32 selector = keccak256("UNDERLYING_ASSET_ADDRESS()");

        bool success;
        assembly {
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 32))
            mstore(ptr, selector)
            success := staticcall(
                6000, //estimated gas costs
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
