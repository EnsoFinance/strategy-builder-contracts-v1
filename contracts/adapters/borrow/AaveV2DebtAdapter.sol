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

import "hardhat/console.sol";

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
            console.log("aave.adapter 0");
            if (from != address(this)){
                uint256 beforeBalance = IERC20(tokenIn).balanceOf(address(this));
                IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
                uint256 afterBalance = IERC20(tokenIn).balanceOf(address(this));
                require(afterBalance > beforeBalance, "No tokens transferred to adapter");
                amount = afterBalance - beforeBalance;
            }
            console.log("aave.adapter !");
            IERC20(tokenIn).safeApprove(lendingPool, amount);

            console.log("aave.adapter 2");
            ILendingPool(lendingPool).repay(tokenIn, amount, 1, to);

            console.log("aave.adapter 3");
        } else if (tokenIn == address(0)) {
            // tokenIn is collateral pool meaning we are taking out loan

            console.log("aave.adapter 4");
            uint256 received = _convert(amount, weth, tokenOut); // lendingPool is valued in weth

            console.log("aave.adapter 5");
            require(received >= expected, "Insufficient tokenOut amount");
            console.log("aave.adapter 6");

            // debug
            console.log(from);
            console.log(to);
            (uint256 totColEth, uint256 totDebtEth, uint256 availBorrowsETH, uint256 currLiqThres, uint256 ltv, uint256 health) = ILendingPool(lendingPool).getUserAccountData(from);
            console.log(totColEth);
            console.log(totDebtEth);
            console.log(availBorrowsETH);
            console.log(currLiqThres);
            console.log(ltv);
            console.log(health);
            //

            ILendingPool(lendingPool).borrow(tokenOut, received, 1, 0, from);

            console.log("aave.adapter 7");
            if (to != address(this))
                IERC20(tokenOut).safeTransfer(to, received);

            console.log("aave.adapter 8");
        } else {
            revert();
        }

       console.log("aave.adapter 9");
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
