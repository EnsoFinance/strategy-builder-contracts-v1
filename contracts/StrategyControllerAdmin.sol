//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/proxy/ProxyAdmin.sol";
import "./StrategyController.sol";

/**
 * @notice Deploys Controller Proxy
 * @dev The contract implements a custom PrxoyAdmin
 * @dev https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/ProxyAdmin.sol
 */
contract StrategyControllerAdmin is ProxyAdmin {
    address public controller;

    constructor() public {
        StrategyController implementation = new StrategyController();
        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy(address(implementation), address(this), new bytes(0));
        controller = address(proxy);
    }
}
