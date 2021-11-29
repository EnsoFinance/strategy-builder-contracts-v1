//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../BaseAdapter.sol";
import "../../interfaces/aave/ILendingPool.sol";
import "../../interfaces/aave/ILendingPoolAddressesProvider.sol";
import "../../interfaces/aave/IAToken.sol";
import "../../interfaces/IStrategyController.sol";
import "../../interfaces/IERC20NonStandard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract AaveLendAdapter is BaseAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    ILendingPoolAddressesProvider public immutable addressesProvider;
    IStrategyController public immutable strategyController;

    constructor(address addressesProvider_, address strategyController_, address weth_) public BaseAdapter(weth_) {
        addressesProvider = ILendingPoolAddressesProvider(addressesProvider_);
        strategyController = IStrategyController(strategyController_);
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        (tokenIn, tokenOut); // Assume correct tokens are submitted
        return amount;
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
        require(amount >= expected, "Insufficient tokenOut amount");
        if (from != address(this))
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
        if (_checkAToken(tokenOut)) {
            require(IAToken(tokenOut).UNDERLYING_ASSET_ADDRESS() == tokenIn, "Incompatible");
            address lendingPool = addressesProvider.getLendingPool();
            IERC20(tokenIn).approve(lendingPool, amount);
            ILendingPool(lendingPool).deposit(tokenIn, amount, to, 0);
            if (strategyController.initialized(to)) {
                //Add as collateral
                IStrategy(to).setCollateral(tokenIn);
            }
        } else {
            require(IAToken(tokenIn).UNDERLYING_ASSET_ADDRESS() == tokenOut, "Incompatible");
            ILendingPool(addressesProvider.getLendingPool()).withdraw(tokenOut, amount, to);
        }
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
