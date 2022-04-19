//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../libraries/SafeERC20.sol";
import "../../interfaces/aave/ILendingPool.sol";
import "../../interfaces/aave/ILendingPoolAddressesProvider.sol";
import "../../interfaces/aave/IAToken.sol";
import "../../interfaces/IStrategyController.sol";
import "../../interfaces/IERC20NonStandard.sol";
import "../../helpers/GasCostProvider.sol";
import "../BaseAdapter.sol";

contract AaveV2Adapter is BaseAdapter {
    using SafeERC20 for IERC20;

    ILendingPoolAddressesProvider public immutable addressesProvider;
    IStrategyController public immutable strategyController;
    GasCostProvider public immutable gasCostProvider;

    constructor(address addressesProvider_, address strategyController_, address weth_) public BaseAdapter(weth_) {
        addressesProvider = ILendingPoolAddressesProvider(addressesProvider_);
        strategyController = IStrategyController(strategyController_);
        gasCostProvider = new GasCostProvider(6000, msg.sender); // estimated gas cost
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
            IERC20(tokenIn).safeApprove(lendingPool, amount);
            ILendingPool(lendingPool).deposit(tokenIn, amount, to, 0);
            if (strategyController.initialized(to)) {
                //Add as collateral if strategy supports debt
                IStrategy strategy = IStrategy(to);
                if (strategy.supportsDebt()) strategy.setCollateral(tokenIn);
            }
        } else {
            require(IAToken(tokenIn).UNDERLYING_ASSET_ADDRESS() == tokenOut, "Incompatible");
            uint256 balance = IERC20(tokenIn).balanceOf(address(this));
            if (balance < amount) amount = balance; //Protoect against Aave's off-by-one rounding issue
            ILendingPool(addressesProvider.getLendingPool()).withdraw(tokenOut, amount, to);
        }
    }

    function _checkAToken(address token) internal view returns (bool) {
        bytes32 selector = keccak256("UNDERLYING_ASSET_ADDRESS()");
        uint256 gasCost = gasCostProvider.gasCost();

        bool success;
        address underlying;
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
            underlying := mload(ptr)
        }
        return success && underlying != address(0);
    }
}
