//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/proxy/ProxyAdmin.sol";

/**
 * @notice Deploys Controller Proxy
 * @dev The contract implements a custom PrxoyAdmin
 * @dev https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/ProxyAdmin.sol
 */
contract PlatformProxyAdmin is ProxyAdmin {
    address payable public immutable controller;
    address payable public immutable factory;
    address private immutable deployer;
    bool private initialized;

    constructor() public {
        // Set address in storage
        controller = _calculateAddress('StrategyController');
        factory = _calculateAddress('StrategyProxyFactory');
        deployer = msg.sender;
    }

    function initialize(
        address controllerImplementation,
        address factoryImplementation,
        address strategyImplementation,
        address oracle,
        address registry,
        address whitelist,
        address pool
    ) public {
        require(msg.sender == deployer, "Not deployer");
        require(!initialized, "Initialized");
        initialized = true;
        // Deploy proxies without proper implementation or initialization in order
        // to get predictable addresses since we need to know addresses to deploy implementation
        TransparentUpgradeableProxy controllerProxy =
            new TransparentUpgradeableProxy{salt: keccak256(abi.encodePacked('StrategyController'))}(
              address(this),
              address(this),
              new bytes(0)
          );
        TransparentUpgradeableProxy factoryProxy =
            new TransparentUpgradeableProxy{salt: keccak256(abi.encodePacked('StrategyProxyFactory'))}(
              address(this),
              address(this),
              new bytes(0)
          );
        // Upgrade proxies to correct implementation and initialize
        upgradeAndCall(
          factoryProxy,
          factoryImplementation,
          abi.encodeWithSelector(
              bytes4(keccak256("initialize(address,address,address,address,address,address)")),
              msg.sender,
              strategyImplementation,
              oracle,
              registry,
              whitelist,
              pool
          )
        );
        upgradeAndCall(
          controllerProxy,
          controllerImplementation,
          abi.encodeWithSelector(
              bytes4(keccak256("initialize()"))
          )
        );
    }

    function controllerImplementation() external view returns (address) {
        return getProxyImplementation(TransparentUpgradeableProxy(controller));
    }

    function factoryImplementation() external view returns (address) {
        return getProxyImplementation(TransparentUpgradeableProxy(factory));
    }

    // Pre-calculate the proxy address
    function _calculateAddress(string memory name)
        internal
        view
        returns (address payable)
    {
        bytes32 hash = keccak256(
            abi.encodePacked(
              bytes1(0xff),
              address(this),
              keccak256(abi.encodePacked(name)),
              keccak256(abi.encodePacked(
                type(TransparentUpgradeableProxy).creationCode,
                abi.encode(address(this), address(this), new bytes(0))
              )))
        );

        // NOTE: cast last 20 bytes of hash to address
        return address(uint160(uint(hash)));
    }
}
