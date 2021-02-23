// SPDX-License-Identifier: Unlicensed
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./PortfolioRouter.sol";
import "../interfaces/IExchangeAdapter.sol";
import "../helpers/Multicall.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice An experimental contract to allow for flexible trading strategies by aggregating calldata to accomplish a rebalance
 */
contract GenericRouter is PortfolioRouter, Multicall {
    /**
     * @notice Setup PortfolioRouter with the weth address
     */
    constructor(address controller_, address weth_) public PortfolioRouter(controller_, weth_) {} //solhint-disable-line

    /**
     * @notice Executes provided calldata to achieve a deposit for the Portfolio
     */
    // Receive call from controller
    function deposit(address portfolio, bytes memory data)
        external
        payable
        override
        onlyController
    {
        (portfolio);
        Call[] memory callStructs = abi.decode(data, (Call[])); //solhint-disable-line
        aggregate(callStructs);
        require(address(this).balance == uint256(0), "GR.deposit: Leftover funds");
    }

    /**
     * @notice Executes provided calldata to achieve a rebalance for the Portfolio
     */
    // Receive call from controller
    function rebalance(address portfolio, bytes memory data) external override onlyController {
        (portfolio);
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
        address adapter,
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        bytes memory data
    ) public {
        _onlyInternal();
        require(
            _delegateSwap(
                adapter,
                amount,
                expected,
                tokenIn,
                tokenOut,
                portfolio,
                portfolio,
                data
            ),
            "GR.delegateSwap: Swap failed"
        );
    }

    function settleSwap(
        address adapter,
        address tokenIn,
        address tokenOut,
        address from,
        address to,
        bytes memory data
    ) public {
        _onlyInternal();
        uint256 amount = IERC20(tokenIn).balanceOf(from);
        if (amount > 0) {
            require(
                _delegateSwap(adapter, amount, 0, tokenIn, tokenOut, from, to, data),
                "GR.delegateSwap: Swap failed"
            );
        }
    }

    function _onlyInternal() internal view {
        require(msg.sender == address(this), "GR.settleSwap: Only internal");
    }
}
