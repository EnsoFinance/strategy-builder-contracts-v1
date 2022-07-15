// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";
import "../interfaces/IClonableTransparentUpgradeableProxy.sol";
import "./CloneInitializable.sol";

contract ClonableTransparentUpgradeableProxy is IClonableTransparentUpgradeableProxy, TransparentUpgradeableProxy, CloneInitializable {
    
    constructor(address _logic, address admin_) public payable TransparentUpgradeableProxy(_logic, admin_, new bytes(0)) initializer {}

    function initialize(address _logic, address admin_) external override initializer {
        assert(__ADMIN_SLOT == bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1));
        __setAdmin(admin_);
        assert(__IMPLEMENTATION_SLOT == bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1));
        __setImplementation(_logic);
    }

    function getImplementation() external view override returns(address) {
        return _implementation();
    }

    /**
     * @dev Storage slot with the admin of the contract.
     * This is the keccak-256 hash of "eip1967.proxy.admin" subtracted by 1, and is
     * validated in the constructor.
     */
    bytes32 private constant __ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    /**
     * @dev Storage slot with the address of the current implementation.
     * This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1, and is
     * validated in the constructor.
     */
    bytes32 private constant __IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    /**
     * @dev Stores a new address in the EIP1967 admin slot.
     */
    function __setAdmin(address newAdmin) private {
        bytes32 slot = __ADMIN_SLOT;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, newAdmin)
        }
    }

    /**
     * @dev Stores a new address in the EIP1967 implementation slot.
     */
    function __setImplementation(address newImplementation) private {
        require(Address.isContract(newImplementation), "UpgradeableProxy: new implementation is not a contract");

        bytes32 slot = __IMPLEMENTATION_SLOT;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, newImplementation)
        }
    }

    function _beforeFallback() internal override {
        // TransparentUpgradeableProxy prevents admin from calling fallback
    }
}
