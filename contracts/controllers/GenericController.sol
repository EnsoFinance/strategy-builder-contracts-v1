// SPDX-License-Identifier: Unlicensed
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./PortfolioController.sol";
import "../interfaces/IPortfolioRouter.sol";
import "../helpers/Multicall.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice An experimental contract to allow for flexible trading strategies by aggregating calldata to accomplish a rebalance
 */
contract GenericController is PortfolioController, Multicall {
    /**
     * @notice Setup PortfolioController with the weth address
     */
    constructor(address weth_) public PortfolioController(weth_) {} //solhint-disable-line

    /**
     * @notice Executes provided calldata to achieve a rebalance for the Portfolio
     */
    // Receive call from portfolio
    function rebalance(bytes memory data) external override {
        Call[] memory callStructs = abi.decode(data, (Call[])); //solhint-disable-line
        aggregate(callStructs);
    }

    /**
     * @notice Helper function to encode typed struct into bytes
     */
    function encodeCalls(Call[] calldata calls) external pure returns (bytes memory data) {
        data = abi.encode(calls);
    }

    /**
     * @notice Uses delegate call to swap tokens
     * @dev Delegate call to avoid redundant token transfers
     */
    function delegateSwap(
        address portfolio,
        address router,
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        bytes memory data
    ) public {
        require(
            msg.sender == address(this),
            "GenericController.delegateSwap: Function may only be called from the rebalance function"
        );
        require(
            _delegateSwap(router, amount, expected, tokenIn, tokenOut, portfolio, portfolio, data),
            "GenericController.delegateSwap: Swap failed"
        );
    }

    function settleSwap(
        address portfolio,
        address router,
        address tokenIn,
        address tokenOut,
        bytes memory data
    ) public {
        require(
            msg.sender == address(this),
            "GenericController.settleSwap: Function may only be called from the rebalance function"
        );
        uint256 amount = IERC20(tokenIn).balanceOf(portfolio);
        if (amount > 0) {
            //erc20.approve(router, amount);
            //IPortfolioRouter(router).swap(amount, 0, tokenIn, tokenOut, address(this), to, data, package);
            require(
                _delegateSwap(router, amount, 0, tokenIn, tokenOut, portfolio, portfolio, data),
                "GenericController.delegateSwap: Swap failed"
            );
        }
    }
}
