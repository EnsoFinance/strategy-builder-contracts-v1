//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./StrategyRouter.sol";
import "../helpers/Multicall.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

/**
 * @notice An experimental contract to allow for flexible trading strategies by aggregating calldata to accomplish a rebalance
 */
contract GenericRouter is StrategyRouter, Multicall {
    using SafeERC20 for IERC20;

    /**
     * @notice Setup StrategyRouter
     */
    constructor(address controller_) public StrategyRouter(RouterCategory.GENERIC, controller_) {}

    /**
     * @notice Executes provided calldata to achieve a deposit for the Strategy
     */
    // Receive call from controller
    function deposit(address strategy, bytes memory data)
        external
        override
        onlyStrategy(strategy)
    {
        Call[] memory callStructs = abi.decode(data, (Call[]));
        aggregate(callStructs);
    }

    function withdraw(address strategy, bytes calldata data)
        external
        override
        onlyStrategy(strategy)
    {
        Call[] memory callStructs = abi.decode(data, (Call[]));
        aggregate(callStructs);
    }

    /**
     * @notice Executes provided calldata to achieve a rebalance for the Strategy
     */
    // Receive call from controller
    function rebalance(address strategy, bytes memory data) external override onlyController {
        (strategy);
        Call[] memory callStructs = abi.decode(data, (Call[]));
        aggregate(callStructs);
    }

    function restructure(address strategy, bytes memory data) external override onlyController {
        (strategy);
        Call[] memory callStructs = abi.decode(data, (Call[]));
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
        address adapter,
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public {
        _onlyInternal();
        require(
            _delegateSwap(
                adapter,
                amount,
                expected,
                tokenIn,
                tokenOut,
                from,
                to
            ),
            "Swap failed"
        );
    }

    function settleSwap(
        address adapter,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public {
        _onlyInternal();
        uint256 amount = IERC20(tokenIn).balanceOf(from);
        if (amount > 0) {
            require(
                _delegateSwap(adapter, amount, 0, tokenIn, tokenOut, from, to),
                "Swap failed"
            );
        }
    }

    function settleTransfer(
        address token,
        address to
    ) public {
        _onlyInternal();
        IERC20 erc20 = IERC20(token);
        uint256 amount = erc20.balanceOf(address(this));
        if (amount > 0) erc20.safeTransfer(to, amount);
    }

    function settleTransferFrom(
        address token,
        address from,
        address to
    ) public {
        _onlyInternal();
        IERC20 erc20 = IERC20(token);
        uint256 amount = erc20.balanceOf(from);
        if (amount > 0) erc20.safeTransferFrom(from, to, amount);
    }

    function _onlyInternal() internal view {
        require(msg.sender == address(this), "Only internal");
    }
}
