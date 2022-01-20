//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/SafeERC20.sol";
import "../../interfaces/IStrategy.sol";
import "../../interfaces/IStrategyController.sol";
import "../../interfaces/IStrategyRouter.sol";
import "../../interfaces/IOracle.sol";
import "../../helpers/StrategyTypes.sol";
import "../BaseAdapter.sol";


contract MetaStrategyAdapter is BaseAdapter, StrategyTypes {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant DEFAULT_SLIPPAGE = 980; //98%
    IStrategyController public immutable controller;
    IStrategyRouter public immutable router;


    constructor(
        address controller_,
        address router_,
        address weth_
    ) public BaseAdapter(weth_) {
        controller = IStrategyController(controller_);
        router = IStrategyRouter(router_);
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        return _getPrice(amount, tokenIn, tokenOut);
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
        require(tokenIn == weth || tokenOut == weth, "No WETH");

        if (from != address(this))
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);

        if (tokenIn == weth) {
            if(address(router) != address(this))
                IERC20(tokenIn).safeApprove(address(router), amount);
            //Assumes the use of LoopRouter when depositing tokens
            controller.deposit(IStrategy(tokenOut), router, amount, DEFAULT_SLIPPAGE, "0x");
            if(address(router) != address(this))
                IERC20(tokenIn).safeApprove(address(router), 0);
        }

        if (tokenOut == weth)
            controller.withdrawWETH(IStrategy(tokenIn), router, amount, DEFAULT_SLIPPAGE, "0x");

        uint256 received = IERC20(tokenOut).balanceOf(address(this));
        require(received >= expected, "Insufficient tokenOut amount");

        if (to != address(this))
          IERC20(tokenOut).safeTransfer(to, received);
    }

    function _getPrice(
      uint256 amount,
      address tokenIn,
      address tokenOut
    ) internal view returns (uint256) {
        if (tokenIn == tokenOut) return amount;
        if (tokenIn == weth) {
            IStrategy strategy = IStrategy(tokenOut);
            uint256 totalSupply = strategy.totalSupply();
            (uint256 total, ) = strategy.oracle().estimateStrategy(strategy);

            return totalSupply.mul(amount).div(total);
        }
        if (tokenOut == weth) {
            IStrategy strategy = IStrategy(tokenIn);
            address[] memory strategyItems = strategy.items();
            uint256 totalSupply = strategy.totalSupply();
            uint256 total;
            for (uint256 i = 0; i < strategyItems.length; i++) {
                address item = strategyItems[i];
                uint256 relativeAmount = IERC20(item).balanceOf(address(strategy)).mul(amount).div(totalSupply);
                if (item == weth) {
                  total = total.add(relativeAmount);
                } else {
                    uint256 category = strategy.oracle().tokenRegistry().estimatorCategories(item);
                    if (category == uint256(EstimatorCategory.STRATEGY)) {
                        total = total.add(_getPrice(relativeAmount, item, weth));
                    } else {
                        total = total.add(_pathPrice(strategy.getTradeData(item), relativeAmount, item));
                    }
                }
            }
            return total;
        }
        return 0;
    }

    function _pathPrice(
        TradeData memory data,
        uint256 amount,
        address token
    ) internal view returns (uint256){
        for (uint256 i = 0; i < data.adapters.length; i++) {
            address tokenIn;
            address tokenOut;
            if (i == 0) {
                tokenIn = weth;
            } else {
                tokenIn = data.path[i-1];
            }
            if (i == data.adapters.length-1) {
                tokenOut = token;
            } else {
                tokenOut = data.path[i];
            }
            amount = IBaseAdapter(data.adapters[i]).spotPrice(amount, tokenIn, tokenOut);
        }
        return amount;
    }
}
