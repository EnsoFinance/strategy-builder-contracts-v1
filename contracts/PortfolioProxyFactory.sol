//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";
import "./PortfolioProxyInitializer.sol";
import "./PortfolioProxyAdminRegistry.sol";
import "./interfaces/IPortfolioProxyFactory.sol";


// The contract implements a custom PrxoyAdmin
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/ProxyAdmin.sol
contract PortfolioProxyFactory is IPortfolioProxyFactory, Ownable {
    PortfolioProxyInitializer private initializer;
    PortfolioProxyAdminRegistry private adminRegistry;
    address public override implementation;
    address public override whitelist;
    address public override oracle;
    address public override controller;
    uint256 public override version;

    event Update(address newImplementation, uint256 version);
    event NewPortfolio(address portfolio, address manager, string name, string symbol, address[] tokens, uint256[] percentages, uint256 threshold, uint256 slippage, uint256 timelock); //solhint-disable-line
    event NewOracle(address newOracle);
    event NewWhitelist(address newWhitelist);
    event NewController(address newController);

    constructor(
        address implementation_,
        address oracle_,
        address whitelist_,
        address controller_
    ) public {
        implementation = implementation_;
        oracle = oracle_;
        whitelist = whitelist_;
        controller = controller_;
        version = 1;
        initializer = new PortfolioProxyInitializer(address(this));
        adminRegistry = new PortfolioProxyAdminRegistry(address(this));
        emit Update(implementation, version);
        emit NewOracle(oracle);
        emit NewWhitelist(whitelist);
        emit NewController(controller);
    }

    modifier onlyAdmin(address proxy) {
        require(adminRegistry.admin(proxy) == msg.sender, "PortfolioProxyFactory (onlyAdmin): User not admin");
        _;
    }

    function createPortfolio(
        string memory name,
        string memory symbol,
        address[] memory routers,
        address[] memory tokens,
        uint256[] memory percentages,
        uint256 threshold,
        uint256 slippage,
        uint256 timelock
    ) external payable {
        /*
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            implementation,
            address(this),
            abi.encodeWithSelector(
                bytes4(keccak256("initialize(address,string,string,address[],uint256[],uint256,uint256,uint256)")), // solhint-disable-line
                msg.sender,
                name,
                symbol,
                tokens,
                percentages,
                threshold,
                slippage,
                timelock
            )
        );
        */
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            implementation,
            address(this),
            new bytes(0)
        );
        /*
         * This contract cannot directly call the initialize() function during the deployment of the
         * proxy because that particular function calls a PortfolioRouter which then calls back to the yet to
         * be fully deployed Proxy. However, we also cannot directly call the initialize() function
         * after deployment because TransparentUpgradeableProxy restricts what calls the admin (this
         * contract) is able to make. We are using PortfolioProxyInitializer contract as a little hack
         * to scoot around the restrictions of the TransparentUpgradeableProxy.
        */
        initializer.initialize{value: msg.value}( // solhint-disable-line
            address(proxy),
            msg.sender,
            name,
            symbol,
            routers,
            tokens,
            percentages,
            threshold,
            slippage,
            timelock
        );
        emit NewPortfolio(address(proxy), msg.sender, name, symbol, tokens, percentages, threshold, slippage, timelock);
    }

    function updateImplementation(address newImplementation) external onlyOwner {
        implementation = newImplementation;
        version++;
        emit Update(newImplementation, version);
    }

    function updateOracle(address newOracle) external onlyOwner {
        oracle = newOracle;
        emit NewOracle(newOracle);
    }

    function updateWhitelist(address newWhitelist) external onlyOwner {
        whitelist = newWhitelist;
        emit NewWhitelist(newWhitelist);
    }

    function updateController(address newController) external onlyOwner {
        controller = newController;
        emit NewController(newController);
    }

    /**
     * @dev Returns the current implementation of `proxy`.
     *
     * Requirements:
     *
     * - This contract must be the admin of `proxy`.
     */
    function getProxyImplementation(TransparentUpgradeableProxy proxy) public view returns (address) {
        // We need to manually run the static call since the getter cannot be flagged as view
        // bytes4(keccak256("implementation()")) == 0x5c60da1b
        (bool success, bytes memory returndata) = address(proxy).staticcall(hex"5c60da1b");
        require(success);
        return abi.decode(returndata, (address));
    }

    /**
     * @dev Returns the current admin of `proxy`.
     *
     * Requirements:
     *
     * - This contract must be the admin of `proxy`.
     */
    function getProxyAdmin(TransparentUpgradeableProxy proxy) public view returns (address) {
        // We need to manually run the static call since the getter cannot be flagged as view
        // bytes4(keccak256("admin()")) == 0xf851a440
        (bool success, bytes memory returndata) = address(proxy).staticcall(hex"f851a440");
        require(success);
        return abi.decode(returndata, (address));
    }

    /**
     * @dev Changes the admin of `proxy` to `newAdmin`.
     *
     * Requirements:
     *
     * - This contract must be the current admin of `proxy`.
     */
    function changeProxyAdmin(TransparentUpgradeableProxy proxy, address newAdmin) public onlyAdmin(address(proxy)) {
        proxy.changeAdmin(newAdmin);
    }

    /**
     * @dev Upgrades `proxy` to `implementation`. See {TransparentUpgradeableProxy-upgradeTo}.
     *
     * Requirements:
     *
     * - This contract must be the admin of `proxy`.
     */
    function upgrade(TransparentUpgradeableProxy proxy) public onlyAdmin(address(proxy)) {
        proxy.upgradeTo(implementation);
    }

    /**
     * @dev Upgrades `proxy` to `implementation` and calls a function on the new implementation. See
     * {TransparentUpgradeableProxy-upgradeToAndCall}.
     *
     * Requirements:
     *
     * - This contract must be the admin of `proxy`.
     */
    function upgradeAndCall(
        TransparentUpgradeableProxy proxy, //solhint-disable-line
        bytes memory data
    ) public payable onlyAdmin(address(proxy)) {
        proxy.upgradeToAndCall{value: msg.value}(implementation, data); //solhint-disable-line
    }
}
