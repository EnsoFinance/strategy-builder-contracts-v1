//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../helpers/RevertDebug.sol";
import "../helpers/Multicall.sol";

contract SmartWallet is RevertDebug, Multicall {

    enum ReturnTypes { Bool, Address, Uint, AddressArray, UintArray, Bytes, BytesArray }

    struct ReturnValue {
        ReturnTypes returnType;
        bytes bytevalue;
    }

    /**
        @notice Execute a bunch of batch calls from this contract
     */
    function execute(Call[] memory calls) public {
        bytes[] memory returnData = aggregate(calls);
        emit Executed(returnData);
    }

    // /**
    //     @notice Batch calls with a check for expected return data
    //  */
    // function executeStrict(Call[] memory calls, ReturnValue[] memory expectedReturnData) public {
    //     bytes[] memory returnData = aggregate(calls);
    //     for (uint i = 0; i < calls.length; i++){
    //         // TODO: make lib to compare return values
    //     }
    //     emit Executed(returnData);
    // }

    /**
     * @notice Helper function to encode typed struct into bytes
     */
    function encodeCalls(Call[] calldata calls) external pure returns (bytes memory data) {
        data = abi.encode(calls);
    }

    event Executed(bytes[] returnData);
}
