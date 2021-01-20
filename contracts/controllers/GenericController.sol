// SPDX-License-Identifier: Unlicensed
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Multicall} from "../helpers/Multicall.sol";
import {FlashPortfolio} from "../FlashPortfolio.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract GenericController is Multicall, Ownable {
    address public target;

    // Initiate a rebalance/deposit/withdrawl here
    // Pass in the calldata to be executed on the rebalance() callback
    // TODO: deprecated ...encode FlashPortfolio.rebalance() + use executeWithCallback()
    function initiateRebalance(
        address portfolio,
        address[] memory tokensRequested,
        uint256[] memory amountsRequested,
        Call[] memory internalCalls
    ) public payable onlyOwner {
        target = portfolio;
        // TODO: encode this call as a parameter
        FlashPortfolio(portfolio).rebalance(
            tokensRequested,
            amountsRequested,
            address(this),
            internalCalls
        );
    }

    // Execute batch tx's authorizing _target to call rebalance() function
    function executeWithCallback(Call[] memory calls, address _target)
        external
        payable
        onlyOwner
        returns (bool success)
    {
        target = _target;
        bytes[] memory returnData = aggregate(
            calls
        );
        // TODO: pass in expected returnData[]
        success = true;
    }

    function execute(Call[] memory calls)
        external
        payable
        onlyOwner
        returns (bool success)
    {
        bytes[] memory returnData = aggregate(
            calls
        );
        // TODO: pass in expected returnData[]
        success = true;
    }

    // Receive call from portfolio
function rebalance(bytes memory calls) external payable returns (bool success) {
        require(msg.sender == target, "Only target allowed");
        (Call[] memory callStructs) = abi.decode(calls, (Call[]));
        bytes[] memory returnData = aggregate(callStructs);
        // TODO: validate multicall made profit/returnData
        delete target;
        success = true;
    }
}
