//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./interfaces/IStrategyController.sol";

contract StrategyControllerLens { // TODO make upgradeable

    IStrategyController immutable private _controller; 
    
    // Initialize constructor to disable implementation
    constructor(address controller_) public /*initializer*/ { // FIXME update initializer
        _controller = IStrategyController(controller_);
    }

    function controller() external view returns(IStrategyController) {
        return _controller;
    }

    function estimateWithdrawWETH(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external view returns(uint256 wethAmount) {
        _controller.initialized(address(strategy));
        return _estimateWithdraw(strategy, router, amount, slippage, data);
    }
    
    function _estimateWithdraw(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) internal view returns (uint256 wethAmount) {
        require(amount > 0, "0 amount");
        //strategy.settleSynths(); // debug different
        //strategy.issueStreamingFee(); // debug different
        amount = strategy.estimateBurn(msg.sender, amount); // debug different
        uint256 totalBefore;
        uint256 balanceBefore;
        (totalBefore, balanceBefore, wethAmount, data) = _controller.withdrawPreprocessing(strategy, router, amount, slippage, data);
        
        // Withdraw
        //_useRouter // debug different 
        // Check value and balance

        // simulates _useRouter but returns estimated balances 
        (uint256 totalAfter, uint256 wethBalance, int256[] memory estimatesAfter) = _estimateUseRouter(strategy, router, IStrategyController.Action.WITHDRAW, data);

        wethAmount = _controller.withdrawPostprocessing(strategy, totalBefore, balanceBefore, wethAmount, totalAfter, wethBalance, slippage, estimatesAfter);
        //strategy.approveToken(weth, address(this), wethAmount); // debug different
        //emit Withdraw(address(strategy), msg.sender, wethAmount, amount); // debug different
    }

    function _estimateUseRouter(
        IStrategy strategy,
        IStrategyRouter router,
        IStrategyController.Action action,
        bytes memory data
    ) internal view returns(uint256 totalAfter, uint256 updatedStrategyWethBalance, int256[] memory estimatesAfter) {
        int256[] memory balances;
        //_approveItems(strategy, strategyItems, strategyDebt, address(router), uint256(-1)); // debug different
        if (action == IStrategyController.Action.WITHDRAW) {
            (balances, updatedStrategyWethBalance) = router.estimateWithdraw(address(strategy), data);
        } else if (action == IStrategyController.Action.REBALANCE) {
            //router.rebalance(address(strategy), data);
        } else if (action == IStrategyController.Action.RESTRUCTURE) {
            //router.restructure(address(strategy), data);
        }
        //_approveItems(strategy, strategyItems, strategyDebt, address(router), uint256(0)); // debug different
        (totalAfter, estimatesAfter) = _controller.oracle().estimateStrategy(strategy, balances, updatedStrategyWethBalance); // debug different
        return (totalAfter, updatedStrategyWethBalance, estimatesAfter);
    }
}
