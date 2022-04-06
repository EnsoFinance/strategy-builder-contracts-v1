//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/SafeERC20.sol";
import "../../interfaces/aave/ILendingPool.sol";
import "../../interfaces/aave/IPriceOracleGetter.sol";
import "../../interfaces/aave/ILendingPoolAddressesProvider.sol";
import "../../interfaces/aave/IAToken.sol";
import "../../interfaces/IERC20NonStandard.sol";
import "../BaseAdapter.sol";

contract AaveV2DebtAdapter is BaseAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    ILendingPoolAddressesProvider public immutable addressesProvider;

    constructor(address addressesProvider_, address weth_) public BaseAdapter(weth_) {
        addressesProvider = ILendingPoolAddressesProvider(addressesProvider_);
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
        address lendingPool = addressesProvider.getLendingPool();
        // use zero address to represent strategy's collateral pool reserve which is valued in weth (doesn't matter that it isn't an erc20, since no erc20 functions are used)
        if (tokenOut == address(0)) {
            // since tokenOut is collateral pool, we are paying back loan
            if (from != address(this))
                IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            IERC20(tokenIn).safeApprove(lendingPool, amount);
            ILendingPool(lendingPool).repay(tokenIn, amount, 1, to);
        } else if (tokenIn == address(0)) {
            // tokenIn is collateral pool meaning we are taking out loan
            uint256 received = _convert(amount, weth, tokenOut); // lendingPool is valued in weth
            require(received >= expected, "Insufficient tokenOut amount");
            ILendingPool(lendingPool).borrow(tokenOut, received, 1, 0, from);
            if (to != address(this))
                IERC20(tokenOut).safeTransfer(to, received);
        } else {
            revert();
        }
    }

    function _convert(uint256 amount, address tokenIn, address tokenOut) internal view returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        if (tokenIn == weth) {
          return amount.mul(10**uint256(IERC20NonStandard(tokenOut).decimals())).div(IPriceOracleGetter(addressesProvider.getPriceOracle()).getAssetPrice(tokenOut));
        } else if (tokenOut == weth) {
          return amount.mul(IPriceOracleGetter(addressesProvider.getPriceOracle()).getAssetPrice(tokenIn)).div(10**uint256(IERC20NonStandard(tokenIn).decimals()));
        } else {
          return amount.mul(IPriceOracleGetter(addressesProvider.getPriceOracle()).getAssetPrice(tokenIn))
                       .mul(10**uint256(IERC20NonStandard(tokenOut).decimals()))
                       .div(10**uint256(IERC20NonStandard(tokenIn).decimals()))
                       .div(IPriceOracleGetter(addressesProvider.getPriceOracle()).getAssetPrice(tokenOut));
        }
    }
}
