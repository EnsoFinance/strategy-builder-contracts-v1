//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../../libraries/SafeERC20.sol";
import "../../interfaces/aave/ILendingPool.sol";
import "../../interfaces/aave/ILendingPoolAddressesProvider.sol";
import "../../interfaces/aave/IAToken.sol";
import "../../interfaces/IStrategyController.sol";
import "../../interfaces/IRewardsAdapter.sol";
import "../../interfaces/IERC20NonStandard.sol";
import "../ProtocolAdapter.sol";

contract AaveV2Adapter is ProtocolAdapter, IRewardsAdapter {
    using SafeERC20 for IERC20;

    ILendingPoolAddressesProvider public immutable addressesProvider;
    IStrategyController public immutable strategyController;

    constructor(
      address addressesProvider_,
      address strategyController_,
      address weth_,
      address tokenRegistry_,
      uint256 categoryIndex_
    ) public ProtocolAdapter(weth_, tokenRegistry_, categoryIndex_) {
        addressesProvider = ILendingPoolAddressesProvider(addressesProvider_);
        strategyController = IStrategyController(strategyController_);
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
        if (from != address(this)){
            uint256 beforeBalance = IERC20(tokenIn).balanceOf(address(this));
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            uint256 afterBalance = IERC20(tokenIn).balanceOf(address(this));
            require(afterBalance > beforeBalance, "No tokens transferred to adapter");
            amount = afterBalance - beforeBalance;
        }
        if (_checkToken(tokenOut)) {
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
            require(_checkToken(tokenIn), "No Aave token");
            require(IAToken(tokenIn).UNDERLYING_ASSET_ADDRESS() == tokenOut, "Incompatible");
            uint256 balance = IERC20(tokenIn).balanceOf(address(this));
            if (balance < amount) amount = balance; //Protect against Aave's off-by-one rounding issue
            ILendingPool(addressesProvider.getLendingPool()).withdraw(tokenOut, amount, to);
        }
        uint256 received = IERC20(tokenOut).balanceOf(to);
        require(received >= expected, "Insufficient tokenOut amount");
    }

    // Intended to be called via delegateCall
    function claim(address[] memory tokens) external override {
        IAaveIncentivesController ic;
        address[] memory tokens_ = new address[](1);
        uint256 amount;
        for (uint256 i; i < tokens.length; ++i) {
            // unfortunately have to do loop since claimables are grouped by
            // adapter not by rewards token
            tokens_[0] = tokens[i];
            ic = IAToken(tokens_[0]).getIncentivesController();
            amount = ic.getRewardsBalance(tokens_, address(this));
            ic.claimRewards(tokens_, amount, address(this));
        }
    }

    function rewardsTokens(address token) external view override returns(address[] memory) {
        address[] memory ret = new address[](1);
        ret[0] = IAToken(token).getIncentivesController().REWARD_TOKEN();
        return ret;
    }
}
