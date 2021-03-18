//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

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
        address controller_,
        address oracle_,
        address whitelist_
    ) public {
        StrategyProxyFactory factoryImplementation = new StrategyProxyFactory();
        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy(
                address(factoryImplementation),
                address(this),
                abi.encodeWithSelector(
                    bytes4(keccak256("initialize(address,address,address,address,address)")),
                    msg.sender,
                    strategyImplementation_,
                    controller_,
                    oracle_,
                    whitelist_
                )
            );
        factory = address(proxy);
    }
}
