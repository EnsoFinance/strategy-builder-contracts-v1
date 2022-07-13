//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

contract ControllerLibraryTest {
    function callControllerLibraryFunction(address controller) external returns(bool success) {
        bytes memory selfData = abi.encodeWithSelector(bytes4(keccak256("self()")));
        (bool success, bytes memory res) = controller.call(selfData); 
        if (!success) {
            revert("library call unsuccessful");
        }
    }
}
