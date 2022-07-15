// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IClonableTransparentUpgradeableProxy {
    function initialize(address _logic, address admin_) external;

    function getImplementation() external view returns(address);
} 
