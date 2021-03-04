//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";
import "./PortfolioProxyManagerRegistry.sol";
import "./interfaces/IPortfolioProxyFactory.sol";
import "./interfaces/IPortfolioController.sol";

/**
 * @notice Deploys Proxy Portfolios
 * @dev The contract implements a custom PrxoyAdmin
 * @dev https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/ProxyAdmin.sol
 */
contract PortfolioProxyFactory is IPortfolioProxyFactory, Ownable {
    PortfolioProxyManagerRegistry private managerRegistry;
    address public override controller;
    address public override whitelist;
    address public override oracle;
    address public override implementation;
    uint256 public override version;

    /**
     * @notice Log the address of an implementation contract update
     */
    event Update(address newImplementation, uint256 version);

    /**
     * @notice Log the creation of a new portfolio
     */
    event NewPortfolio(
        address portfolio,
        address manager,
        string name,
        string symbol,
        address[] tokens,
        uint256[] percentages,
        bool social,
        uint256 fee,
        uint256 threshold,
        uint256 slippage,
        uint256 timelock
    );

    /**
     * @notice Log the new Oracle for the portfolios
     */
    event NewOracle(address newOracle);

    /**
     * @notice New default whitelist address
     */
    event NewWhitelist(address newWhitelist);

    constructor(
        address implementation_,
        address controller_,
        address oracle_,
        address whitelist_
    ) public {
        implementation = implementation_;
        controller = controller_;
        oracle = oracle_;
        whitelist = whitelist_;
        version = 1;
        managerRegistry = new PortfolioProxyManagerRegistry(address(this));
        emit Update(implementation, version);
        emit NewOracle(oracle);
        emit NewWhitelist(whitelist);
    }

    modifier onlyManager(address proxy) {
        require(managerRegistry.manager(proxy) == msg.sender, "PPF.onlyManager: Not manager");
        _;
    }

    function createPortfolio(
        string memory name,
        string memory symbol,
        address[] memory tokens,
        uint256[] memory percentages,
        bool social,
        uint256 fee,
        uint256 threshold,
        uint256 slippage,
        uint256 timelock,
        address router,
        bytes memory data
    ) external payable {
        address portfolio = _createProxy(name, symbol, tokens, percentages);
        IPortfolioController(controller).setupPortfolio{value: msg.value}(
            msg.sender,
            portfolio,
            social,
            fee,
            threshold,
            slippage,
            timelock,
            router,
            data
        );
        emit NewPortfolio(
            portfolio,
            msg.sender,
            name,
            symbol,
            tokens,
            percentages,
            social,
            fee,
            threshold,
            slippage,
            timelock
        );
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

    function salt(address creator, string memory name, string memory symbol) public pure returns (bytes32) {
      return keccak256(abi.encodePacked(creator, name, symbol));
    }

    /**
     * @dev Returns the current implementation of `proxy`.
     *
     * Requirements:
     *
     * - This contract must be the admin of `proxy`.
     */
    function getProxyImplementation(TransparentUpgradeableProxy proxy)
        public
        view
        returns (address)
    {
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
    function changeProxyAdmin(TransparentUpgradeableProxy proxy, address newAdmin)
        public
        onlyManager(address(proxy))
    {
        proxy.changeAdmin(newAdmin);
    }

    /**
     * @dev Upgrades `proxy` to `implementation`. See {TransparentUpgradeableProxy-upgradeTo}.
     *
     * Requirements:
     *
     * - This contract must be the admin of `proxy`.
     */
    function upgrade(TransparentUpgradeableProxy proxy) public onlyManager(address(proxy)) {
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
        TransparentUpgradeableProxy proxy,
        bytes memory data
    ) public payable onlyManager(address(proxy)) {
        proxy.upgradeToAndCall{value: msg.value}(implementation, data);
    }

    function _createProxy(
        string memory name, string memory symbol, address[] memory tokens, uint256[] memory percentages
    ) internal returns (address) {
        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy{salt: salt(msg.sender, name, symbol)}(
                    implementation,
                    address(this),
                    abi.encodeWithSelector(
                        bytes4(keccak256("initialize(string,string,uint256,address,address,address[],uint256[])")),
                        name,
                        symbol,
                        version,
                        controller,
                        msg.sender,
                        tokens,
                        percentages
                    )
                  );
      return address(proxy);
    }
}
