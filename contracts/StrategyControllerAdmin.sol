//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/proxy/ProxyAdmin.sol";

/**
 * @notice Deploys Controller Proxy
 * @dev The contract implements a custom PrxoyAdmin
 * @dev https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/ProxyAdmin.sol
 */
contract StrategyControllerAdmin is ProxyAdmin {
    address payable public controller;

    constructor(address implementation, address factory) public {
        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy(
              address(implementation),
              address(this),
              abi.encodeWithSelector(
                  bytes4(keccak256("initialize(address)")),
                  factory
              )
          );
        controller = address(proxy);
    }

    function implementation() external view returns (address) {
        return getProxyImplementation(TransparentUpgradeableProxy(controller));
    }
}
