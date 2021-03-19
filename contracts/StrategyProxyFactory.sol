//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./StrategyProxyFactoryStorage.sol";
import "./StrategyProxyManagerRegistry.sol";
import "./interfaces/IStrategyProxyFactory.sol";
import "./interfaces/IStrategyController.sol";

/**
 * @notice Deploys Proxy Strategies
 * @dev The contract implements a custom PrxoyAdmin
 * @dev https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/ProxyAdmin.sol
 */
contract StrategyProxyFactory is IStrategyProxyFactory, StrategyProxyFactoryStorage, Initializable {
    StrategyProxyManagerRegistry private immutable managerRegistry;

    /**
     * @notice Log the address of an implementation contract update
     */
    event Update(address newImplementation, uint256 version);

    /**
     * @notice Log the creation of a new strategy
     */
    event NewStrategy(
        address strategy,
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
     * @notice Log the new Oracle for the strategys
     */
    event NewOracle(address newOracle);

    /**
     * @notice New default whitelist address
     */
    event NewWhitelist(address newWhitelist);

    /**
     * @notice Log ownership transfer
     */
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @notice Initialize constructor to disable implementation
     */
    constructor() public initializer {
        managerRegistry = new StrategyProxyManagerRegistry(address(this));
    }

    function initialize(
        address owner_,
        address implementation_,
        address controller_,
        address oracle_,
        address whitelist_
    ) external initializer returns (bool){
        _owner = owner_;
        _implementation = implementation_;
        _controller = controller_;
        _oracle = oracle_;
        _whitelist = whitelist_;
        _version = 1;
        emit Update(_implementation, _version);
        emit NewOracle(_oracle);
        emit NewWhitelist(_whitelist);
        emit OwnershipTransferred(address(0), _owner);
        return true;
    }

    modifier onlyManager(address proxy) {
        require(managerRegistry.manager(proxy) == msg.sender, "Not manager");
        _;
    }

    modifier onlyOwner() {
        require(_owner == msg.sender, "Not owner");
        _;
    }

    /**
        @notice Entry point for creating new Strategies.
        @notice Creates a new proxy for the current implementation and initializes the strategy with the provided input
        @dev Can send ETH with this call to automatically deposit items into the strategy
    */
    function createStrategy(
        address manager,
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
    ) external payable override returns (address){
        address strategy = _createProxy(manager, name, symbol, tokens, percentages);
        _setupStrategy(
           manager,
           strategy,
           social,
           fee,
           threshold,
           slippage,
           timelock,
           router,
           data
        );
        emit NewStrategy(
            strategy,
            manager,
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
        return strategy;
    }

    function updateImplementation(address newImplementation) external onlyOwner {
        _implementation = newImplementation;
        _version++;
        emit Update(newImplementation, _version);
    }

    function updateOracle(address newOracle) external onlyOwner {
        _oracle = newOracle;
        emit NewOracle(newOracle);
    }

    function updateWhitelist(address newWhitelist) external onlyOwner {
        _whitelist = newWhitelist;
        emit NewWhitelist(newWhitelist);
    }

    function salt(address manager, string memory name, string memory symbol) public pure override returns (bytes32) {
      return keccak256(abi.encodePacked(manager, name, symbol));
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
        proxy.upgradeTo(_implementation);
    }

    /**
     * @dev Upgrades `proxy` to `implementation` and calls a function on the new implementation. See
     * {TransparentUpgradeableProxy-upgradeToAndCall}.
     *
     * Requirements:
     *
     * - This contract must be the admin of `proxy`.
     */
    function upgradeAndCall(TransparentUpgradeableProxy proxy, bytes memory data)
        public
        payable
        onlyManager(address(proxy))
    {
        proxy.upgradeToAndCall{value: msg.value}(_implementation, data);
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }

    function owner() external view returns (address) {
        return _owner;
    }

    function controller() external view override returns (address) {
        return _controller;
    }

    function whitelist() external view override returns (address) {
        return _whitelist;
    }

    function oracle() external view override returns (address) {
        return _oracle;
    }

    function implementation() external view override returns (address) {
        return _implementation;
    }

    function version() external view override returns (uint256) {
        return _version;
    }

    /**
        @notice Creates a Strategy proxy and makes a delegate call to initialize items + percentages on the proxy
    */
    function _createProxy(
        address manager, string memory name, string memory symbol, address[] memory tokens, uint256[] memory percentages
    ) internal returns (address) {
        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy{salt: salt(manager, name, symbol)}(
                    _implementation,
                    address(this),
                    abi.encodeWithSelector(
                        bytes4(keccak256("initialize(string,string,uint256,address,address,address[],uint256[])")),
                        name,
                        symbol,
                        _version,
                        _controller,
                        manager,
                        tokens,
                        percentages
                    )
                  );
      return address(proxy);
    }

    function _setupStrategy(
        address manager,
        address strategy,
        bool social,
        uint256 fee,
        uint256 threshold,
        uint256 slippage,
        uint256 timelock,
        address router,
        bytes memory data
    ) internal {
        IStrategyController strategyController = IStrategyController(_controller);
        strategyController.setupStrategy{value: msg.value}(
            manager,
            strategy,
            social,
            fee,
            threshold,
            slippage,
            timelock,
            router,
            data
        );
    }
}
