//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./StrategyProxyFactoryStorage.sol";
import "./StrategyProxyAdmin.sol";
import "./helpers/StrategyTypes.sol";
import "./helpers/AddressUtils.sol";
import "./helpers/StringUtils.sol";
import "./helpers/EIP712.sol";
import "./interfaces/IStrategyProxyFactory.sol";
import "./interfaces/IStrategyManagement.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/IOracle.sol";
import "./interfaces/registries/ITokenRegistry.sol";

/**
 * @notice Deploys Proxy Strategies
 * @dev The contract implements a custom PrxoyAdmin
 * @dev https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/ProxyAdmin.sol
 */
contract StrategyProxyFactory is IStrategyProxyFactory, StrategyProxyFactoryStorage, Initializable, AddressUtils, StringUtils, EIP712 {
    using SafeMath for uint256;

    uint256 internal constant PRECISION = 10**18;
    uint256 internal constant DIVISOR = 1000;

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
     * @notice Log the new Oracle for the strategies
     */
    event NewOracle(address newOracle);

    /**
     * @notice Log the new TokenRegistry for the strategies
     */
    event NewRegistry(address newRegistry);

    /**
     * @notice New default whitelist address
     */
    event NewWhitelist(address newWhitelist);

    /**
     * @notice New default pool address
     */
    event NewPool(address newPool);

    /**
     * @notice New streaming fee percentage
     */
    event NewStreamingFee(uint256 newStreamingFee);

    /**
     * @notice Log ownership transfer
     */
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    bytes32 private constant _CREATE_TYPEHASH =
      keccak256("Create(string name,string symbol)");

    /**
     * @notice Initialize constructor to disable implementation
     */
    constructor(address controller_) EIP712("StrategyProxyFactory", "1") initializer {
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
        returns (bool)
    {
        _noZeroAddress(owner_);
        _noZeroAddress(implementation_);
        _noZeroAddress(oracle_);
        _noZeroAddress(registry_);
        _noZeroAddress(whitelist_);
        _noZeroAddress(pool_);
        admin = address(new StrategyProxyAdmin());
        owner = owner_;
        _implementation = implementation_;
        _creationCodeHash = keccak256(abi.encodePacked(
              type(TransparentUpgradeableProxy).creationCode, abi.encode(_implementation, admin, new bytes(0))));
        _oracle = oracle_;
        _registry = registry_;
        _whitelist = whitelist_;
        _pool = pool_;
        _streamingFee = uint256(1001001001001001); // 0.1% inflation
        _version = "1";
        IOracle(_oracle).updateAddresses();
        emit Update(implementation_, "1");
        emit NewOracle(oracle_);
        emit NewWhitelist(whitelist_);
        emit NewPool(pool_);
        emit NewStreamingFee(uint256(1));
        emit OwnershipTransferred(address(0), owner_);
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
        string calldata name,
        string calldata symbol,
        StrategyItem[] memory strategyItems,
        InitialState memory strategyState,
        address router,
        bytes memory data
    ) external payable override returns (address) {
        return _createStrategy(msg.sender, name, symbol, strategyItems, strategyState, router, data);
    }

    function createStrategyFor(
        address manager,
        string calldata name,
        string calldata symbol,
        StrategyItem[] memory strategyItems,
        InitialState memory strategyState,
        address router,
        bytes memory data,
        bytes calldata signature
    ) external payable override returns (address) {
        bytes32 structHash = keccak256(abi.encode(_CREATE_TYPEHASH, keccak256(bytes(name)), keccak256(bytes(symbol))));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == manager, "createStrategyFor: invalid.");
        return _createStrategy(signer, name, symbol, strategyItems, strategyState, router, data);
    }

    function updateImplementation(address newImplementation, string calldata newVersion) external onlyOwner {
        _noZeroAddress(newImplementation);
        require(parseInt(newVersion) > parseInt(_version), "Invalid version");
        _implementation = newImplementation;
        _creationCodeHash = keccak256(abi.encodePacked(
              type(TransparentUpgradeableProxy).creationCode, abi.encode(_implementation, admin, new bytes(0))));
        _version = newVersion;
        emit Update(newImplementation, newVersion);
    }

    function updateOracle(address newOracle) external onlyOwner {
        _noZeroAddress(newOracle);
        _oracle = newOracle;
        emit NewOracle(newOracle);
    }

    function updateRegistry(address newRegistry) external onlyOwner {
        _noZeroAddress(newRegistry);
        _registry = newRegistry;
        IOracle(_oracle).updateAddresses();
        emit NewRegistry(newRegistry);
    }

    function updateWhitelist(address newWhitelist) external onlyOwner {
        _noZeroAddress(newWhitelist);
        _whitelist = newWhitelist;
        emit NewWhitelist(newWhitelist);
    }

    function updatePool(address newPool) external onlyOwner {
        _noZeroAddress(newPool);
        _pool = newPool;
        emit NewPool(newPool);
    }

    /*
     * @param fee The percentage of the total supply that gets minted for the platform over a year
     */
    function updateStreamingFee(uint16 fee) external onlyOwner {
        // The streaming fee mints a percentage of tokens over the course of a year.
        // Due to this inflation, we calculate the _streamingFee multiplier such that
        // when multiplied by the totalSupply equals the amount of tokens to be minted
        // in order to get the correct percentage of the new total supply
        _streamingFee = PRECISION.mul(fee).div(DIVISOR.sub(fee));
        emit NewStreamingFee(uint256(fee));
    }

    function updateRebalanceParameters(uint256 rebalanceTimelockPeriod, uint256 rebalanceThresholdScalar) external onlyOwner {
        IStrategyController(controller).updateRebalanceParameters(rebalanceTimelockPeriod, rebalanceThresholdScalar);
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

    function addItemDetailedToRegistry(
        uint256 itemCategoryIndex,
        uint256 estimatorCategoryIndex,
        address token,
        TradeData memory tradeData,
        bool isClaimable
    ) external onlyOwner {
        _addItemDetailedToRegistry(itemCategoryIndex, estimatorCategoryIndex, token, tradeData, isClaimable);
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        _noZeroAddress(newOwner);
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function salt(address manager, string calldata name, string calldata symbol) public pure override returns (bytes32) {
      return keccak256(abi.encode(manager, name, symbol));
    }

    /*
     * @dev This function is called by Strategy and StrategyController
     */
    function whitelist() external view override returns (address) {
        return _whitelist;
    }

    /*
     * @dev This function is called by StrategyController
     */
    function oracle() external view override returns (address) {
        return _oracle;
    }

    /*
     * @dev This function is called by Strategy
     */
    function tokenRegistry() external view override returns (address) {
        return _registry;
    }

    function pool() external view override returns (address) {
        return _pool;
    }

    function streamingFee() external view override returns (uint256) {
        return _streamingFee;
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

    function _createStrategy(
        address manager,
        string calldata name,
        string calldata symbol,
        StrategyItem[] memory strategyItems,
        InitialState memory strategyState,
        address router,
        bytes memory data
    ) private returns (address) {
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


    /**
        @notice Creates a Strategy proxy and makes a delegate call to initialize items + percentages on the proxy
    */
    function _createProxy(
        address manager, string calldata name, string calldata symbol, StrategyItem[] memory strategyItems
    ) internal returns (address) {
        bytes32 salt_ = salt(manager, name, symbol);
        {
            address predictedProxyAddress = Create2.computeAddress(salt_, _creationCodeHash);
            uint256 codeSize;
            assembly {
                codeSize := extcodesize(predictedProxyAddress)
            }
            require(codeSize == 0, "_createProxy: proxy already exists.");
        }
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy{salt: salt_}(
                    _implementation,
                    admin,
                    new bytes(0) // We greatly simplify CREATE2 when we don't pass initialization data
                  );

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

    function _addItemDetailedToRegistry(
        uint256 itemCategoryIndex,
        uint256 estimatorCategoryIndex,
        address token,
        TradeData memory tradeData,
        bool isClaimable
    ) internal {
        ITokenRegistry(_registry).addItemDetailed(itemCategoryIndex, estimatorCategoryIndex, token, tradeData, isClaimable);
    }
}
