pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./RevertDebug.sol";
import "hardhat/console.sol";

/// @title Multicall - Aggregate internal calls
/// @author Kyle Dewhurst

contract Multicall is RevertDebug {
    using console for *;

    struct Call {
        address payable target;
        bytes callData;
        uint256 value;
    }

    function aggregate(Call[] memory calls)
        internal
        returns (bytes[] memory returnData)
    {
        returnData = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            // console.log("batch msg.value: ", msg.value);
            // console.log("batch balance: ", address(this).balance);
            // console.logBytes(calls[i].callData);
            Call memory internalTx = calls[i];
            require(
                msg.value >= internalTx.value ||
                    address(this).balance >= internalTx.value,
                "Multicall: Not enough wei"
            );
            (bool success, bytes memory ret) =
                internalTx.target.call.value(internalTx.value)(internalTx.callData);
            if (!success) {
                revert(_getPrefixedRevertMsg(ret));
            }
            returnData[i] = ret;
        }
    }

    function getEthBalance(address addr) public view returns (uint256 balance) {
        balance = addr.balance;
    }
}
