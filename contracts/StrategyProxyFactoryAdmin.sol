//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import "@openzeppelin/contracts/proxy/ProxyAdmin.sol";
import "./StrategyProxyFactory.sol";

/**
 * @notice Deploys Controller Proxy
 * @dev The contract implements a custom PrxoyAdmin
 * @dev https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/ProxyAdmin.sol
 */
contract StrategyProxyFactoryAdmin is ProxyAdmin {
    address public factory;

    constructor(
        address strategyImplementation_,
        address oracle_,
        address registry_,
        address whitelist_,
        address pool_
    ) public {
        StrategyProxyFactory factoryImplementation = new StrategyProxyFactory();
        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy(
                address(factoryImplementation),
                address(this),
                abi.encodeWithSelector(
                    bytes4(keccak256("initialize(address,address,address,address,address,address)")),
                    msg.sender,
                    strategyImplementation_,
                    oracle_,
                    registry_,
                    whitelist_,
                    pool_
                )
            );
        factory = address(proxy);
    }
}
