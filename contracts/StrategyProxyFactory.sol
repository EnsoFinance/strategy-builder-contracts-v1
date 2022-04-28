//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./StrategyProxyFactoryStorage.sol";
import "./StrategyProxyAdmin.sol";
import "./helpers/StrategyTypes.sol";
import "./helpers/AddressUtils.sol";
import "./helpers/StringUtils.sol";
import "./interfaces/IStrategyProxyFactory.sol";
import "./interfaces/IStrategyManagement.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/registries/ITokenRegistry.sol";

/**
 * @notice Deploys Proxy Strategies
 * @dev The contract implements a custom PrxoyAdmin
 * @dev https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/ProxyAdmin.sol
 */
contract StrategyProxyFactory is IStrategyProxyFactory, StrategyProxyFactoryStorage, Initializable, AddressUtils, StringUtils {
    address public immutable override controller;

    /**
     * @notice Log the address of an implementation contract update
     */
    event Update(address newImplementation, string version);

    /**
     * @notice Log the creation of a new strategy
     */
    event NewStrategy(
        address strategy,
        address manager,
        string name,
        string symbol,
        StrategyItem[] items
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
     * @notice New default pool address
     */
    event NewPool(address newPool);

    /**
     * @notice Log ownership transfer
     */
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @notice Initialize constructor to disable implementation
     */
    constructor(address controller_) initializer {
        controller = controller_;
    }

    function initialize(
        address owner_,
        address implementation_,
        address oracle_,
        address registry_,
        address whitelist_,
        address pool_
    ) external
        initializer
        noZeroAddress(owner_)
        noZeroAddress(implementation_)
        noZeroAddress(oracle_)
        noZeroAddress(registry_)
        noZeroAddress(whitelist_)
        noZeroAddress(pool_)
        returns (bool)
    {
        admin = address(new StrategyProxyAdmin());
        owner = owner_;
        _implementation = implementation_;
        _oracle = oracle_;
        _registry = registry_;
        _whitelist = whitelist_;
        _pool = pool_;
        _version = "1";
        emit Update(_implementation, _version);
        emit NewOracle(_oracle);
        emit NewWhitelist(_whitelist);
        emit NewPool(_pool);
        emit OwnershipTransferred(address(0), owner);
        return true;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "Not owner");
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
        StrategyItem[] memory strategyItems,
        InitialState memory strategyState,
        address router,
        bytes memory data
    ) external payable override returns (address){
        address strategy = _createProxy(manager, name, symbol, strategyItems);
        emit NewStrategy(
            strategy,
            manager,
            name,
            symbol,
            strategyItems
        );
        _setupStrategy(
           manager,
           strategy,
           strategyState,
           router,
           data
        );
        return strategy;
    }

    function updateImplementation(address newImplementation, string memory newVersion) external noZeroAddress(newImplementation) onlyOwner {
        require(parseInt(newVersion) > parseInt(_version), "Invalid version");
        _implementation = newImplementation;
        _version = newVersion;
        emit Update(newImplementation, _version);
    }

    function updateOracle(address newOracle) external noZeroAddress(newOracle) onlyOwner {
        _oracle = newOracle;
        emit NewOracle(newOracle);
    }

    function updateWhitelist(address newWhitelist) external noZeroAddress(newWhitelist) onlyOwner {
        _whitelist = newWhitelist;
        emit NewWhitelist(newWhitelist);
    }

    function updatePool(address newPool) external noZeroAddress(newPool) onlyOwner {
        _pool = newPool;
        emit NewPool(newPool);
    }

    /*
     * @dev This function is called by StrategyProxyAdmin
     */
    function updateProxyVersion(address proxy) external override {
        require(msg.sender == admin, "Only admin");
        IStrategyManagement(proxy).updateVersion(_version);
    }

    function addEstimatorToRegistry(uint256 estimatorCategoryIndex, address estimator) external onlyOwner {
        ITokenRegistry(_registry).addEstimator(estimatorCategoryIndex, estimator);
    }

    function addItemsToRegistry(uint256[] calldata itemCategoryIndex, uint256[] calldata estimatorCategoryIndex, address[] calldata tokens) external onlyOwner {
        ITokenRegistry(_registry).addItems(itemCategoryIndex, estimatorCategoryIndex, tokens);
    }

    function addItemToRegistry(
        uint256 itemCategoryIndex,
        uint256 estimatorCategoryIndex,
        address token
    ) external onlyOwner {
        _addItemToRegistry(itemCategoryIndex, estimatorCategoryIndex, token);
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public noZeroAddress(newOwner) onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function salt(address manager, string memory name, string memory symbol) public pure override returns (bytes32) {
      return keccak256(abi.encode(manager, name, symbol));
    }

    /*
     * @dev This function is called by Strategy and StrategyController
     */
    function whitelist() external view override returns (address) {
        return _whitelist;
    }

    /*
     * @dev This function is called by  Strategy and StrategyController
     */
    function oracle() external view override returns (address) {
        return _oracle;
    }

    function pool() external view override returns (address) {
        return _pool;
    }

    /*
     * @dev This function is called by StrategyProxyAdmin
     */
    function implementation() external view override returns (address) {
        return _implementation;
    }

    function version() external view override returns (string memory) {
        return _version;
    }

    /*
     * @dev This function is called by StrategyProxyAdmin
     */
    function getManager(address proxy) external view override returns (address) {
        return IStrategyManagement(proxy).manager();
    }

    /**
        @notice Creates a Strategy proxy and makes a delegate call to initialize items + percentages on the proxy
    */
    function _createProxy(
        address manager, string memory name, string memory symbol, StrategyItem[] memory strategyItems
    ) internal returns (address) {
        bytes32 salt_ = salt(manager, name, symbol);
        require(!_proxyExists[salt_], "_createProxy: proxy already exists.");
        TransparentUpgradeableProxy proxy =
            new TransparentUpgradeableProxy{salt: salt_}(
                    _implementation,
                    admin,
                    new bytes(0) // We greatly simplify CREATE2 when we don't pass initialization data
                  );
        _proxyExists[salt_] = true;
        _addItemToRegistry(uint256(ItemCategory.BASIC), uint256(EstimatorCategory.STRATEGY), address(proxy));
        // Instead we initialize it directly in the Strategy contract
        IStrategyManagement(address(proxy)).initialize(
            name,
            symbol,
            _version,
            manager,
            strategyItems
        );
        return address(proxy);
    }

    function _setupStrategy(
        address manager,
        address strategy,
        InitialState memory strategyState,
        address router,
        bytes memory data
    ) internal {
        IStrategyController strategyController = IStrategyController(controller);
        strategyController.setupStrategy{value: msg.value}(
            manager,
            strategy,
            strategyState,
            router,
            data
        );
    }

    function _addItemToRegistry(
        uint256 itemCategoryIndex,
        uint256 estimatorCategoryIndex,
        address token
    ) internal {
        ITokenRegistry(_registry).addItem(itemCategoryIndex, estimatorCategoryIndex, token);
    }

}
