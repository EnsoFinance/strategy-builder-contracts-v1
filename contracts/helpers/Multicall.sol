//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

/// @title Multicall - Aggregate internal calls + show revert message
contract Multicall {
    struct Call {
        address target;
        bytes callData;
    }

    /**
     * @notice Aggregate calls and return a list of the return data
     */
    function aggregate(Call[] memory calls) internal returns (bytes[] memory returnData) {
        uint256 callsLength = calls.length;
        returnData = new bytes[](callsLength);
        Call memory internalTx;
        bool success;
        for (uint256 i; i < callsLength; ++i) {
            internalTx = calls[i];
            assembly { success := extcodesize(mload(internalTx)) }
            require(success, "aggregate: target not a contract.");
            (success, returnData[i]) =
                internalTx.target.call(internalTx.callData);
            if (!success) {
                assembly {
                    let ptr
                    let size
                    size := returndatasize()
                    returndatacopy(ptr, 0, size)
                    revert(ptr, size)
                }
            }
        }
    }
}
