// SPDX-License-Identifier: Unlicensed
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../helpers/RevertDebug.sol";
import "../helpers/Multicall.sol";

contract SmartWallet is RevertDebug, Multicall {
    function execute(Call[] memory calls) public {
        bytes[] memory returnData = aggregate(calls);
        emit Executed(returnData);
    }

    function executeStrict(Call[] memory calls, bytes[] memory expectedReturnData) public {
        bytes[] memory returnData = aggregate(calls);
        emit Executed(returnData);
    }

    /**
     * @notice Helper function to encode typed struct into bytes
     */
    function encodeCalls(Call[] calldata calls) external pure returns (bytes memory data) {
        data = abi.encode(calls);
    }

    event Executed(bytes[] returnData);
}
