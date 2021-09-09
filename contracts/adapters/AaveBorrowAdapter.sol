//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./ExchangeAdapter.sol";
import "../interfaces/aave/ILendingPool.sol";
import "../interfaces/aave/IPriceOracleGetter.sol";
import "../interfaces/aave/ILendingPoolAddressesProvider.sol";
import "../interfaces/aave/IAToken.sol";
import "../interfaces/IERC20NonStandard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract AaveBorrowAdapter is ExchangeAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    //ILendingPool public immutable lendingPool;
    ILendingPoolAddressesProvider public immutable addressesProvider;

    constructor(address addressesProvider_, address weth_) public ExchangeAdapter(weth_) {
        addressesProvider = ILendingPoolAddressesProvider(addressesProvider_);
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        uint256 exchange;
        if (_checkAToken(tokenOut)) {
            exchange = _convert(amount, tokenIn, IAToken(tokenOut).UNDERLYING_ASSET_ADDRESS());
        } else {
            exchange = _convert(amount, IAToken(tokenIn).UNDERLYING_ASSET_ADDRESS(), tokenOut);
        }
        return exchange;
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
        if (_checkAToken(tokenOut)) {
            // tokenOut is collateral aToken which will be returned
            if (from != address(this))
                IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            address lendingPool = addressesProvider.getLendingPool();
            IERC20(tokenIn).approve(lendingPool, amount);
            ILendingPool(lendingPool).repay(tokenIn, amount, 1, to);
        } else {
            // tokenIn is aToken used a collateral for loan
            uint256 received = _convert(amount, IAToken(tokenIn).UNDERLYING_ASSET_ADDRESS(), tokenOut);
            require(received >= expected, "Insufficient tokenOut amount");
            ILendingPool(addressesProvider.getLendingPool()).borrow(tokenOut, received, 1, 0, from);
            if (to != address(this))
                IERC20(tokenOut).safeTransfer(to, received);
        }
        return true;
    }

    function _convert(uint256 amount, address tokenIn, address tokenOut) internal view returns (uint256) {
        return amount.mul(IPriceOracleGetter(addressesProvider.getPriceOracle()).getAssetPrice(tokenIn))
                     .mul(10**uint256(IERC20NonStandard(tokenOut).decimals()))
                     .div(10**uint256(IERC20NonStandard(tokenIn).decimals()))
                     .div(IPriceOracleGetter(addressesProvider.getPriceOracle()).getAssetPrice(tokenOut));
    }

    function _checkAToken(address token) internal view returns (bool) {
        bytes32 selector = keccak256("UNDERLYING_ASSET_ADDRESS()");

        bool success;
        assembly {
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 32))
            mstore(ptr, selector)
            success := staticcall(
                7000, //estimated gas costs
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
