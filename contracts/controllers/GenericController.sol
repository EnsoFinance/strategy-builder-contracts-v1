// SPDX-License-Identifier: Unlicensed
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./PortfolioController.sol";
import "../interfaces/IPortfolioRouter.sol";
import {Multicall} from "../helpers/Multicall.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract GenericController is PortfolioController, Multicall {
    address public target;

    constructor(address weth_) public PortfolioController(weth_) {} //solhint-disable-line

    // Receive call from portfolio
    function rebalance(bytes memory data) external override {
        (Call[] memory callStructs) = abi.decode(data, (Call[])); //solhint-disable-line
        aggregate(callStructs);
        // TODO: validate multicall made profit/returnData
    }

    function encodeCalls(Call[] calldata calls) external pure returns (bytes memory data) {
        data = abi.encode(calls);
    }

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

    /*
    Don't think we need this anymore as funds don't have to be transferred to
    this contract since we're using delegateSwap

    function settleTransfer(
        address token,
        address to
    ) public {
        require(
            msg.sender == address(this),
            "GenericController.settleTransfer: Function may only be called from the rebalance function"
        );
        IERC20 erc20 = IERC20(token);
        uint256 amount = erc20.balanceOf(address(this));
        erc20.transferFrom(address(this), to, amount);
    }
    */
}
