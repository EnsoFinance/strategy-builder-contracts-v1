//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "../../interfaces/IStrategyController.sol";
import "../../interfaces/IStrategyProxyFactory.sol";
import "../../StrategyControllerStorage.sol";

/**
 * @notice This contract has the same interface and storage as `StrategyController` but all mutating external functions will revert.
 */
contract StrategyControllerPaused is IStrategyController, StrategyControllerStorage, Initializable {
    using SignedSafeMath for int256;

    uint256 private constant DIVISOR = 1000;
    int256 private constant PERCENTAGE_BOUND = 10000; // Max 10x leverage

    address public immutable factory;

    // Initialize constructor to disable implementation
    constructor(address factory_) public initializer {
        factory = factory_;
    }

    /**
     * @dev Called to initialize proxy
     */
    function initialize() external initializer {
        revert("StrategyControllerPaused.");
    }

    /**
     * @dev Called during the creation of a new Strategy proxy (see: StrategyProxyFactory.createStrategy())
     * @param manager_ The address that is set as manager
     * @param strategy_ The address of the strategy
     * @param state_ The initial strategy state
     * @param router_ The router in charge of swapping items for this strategy
     * @param data_ Optional bytes data to be passed if using GenericRouter
     */
    function setupStrategy(
        address manager_,
        address strategy_,
        InitialState memory state_,
        address router_,
        bytes memory data_
    ) external payable override {
        (manager_, strategy_, state_, router_, data_); // shh compiler
        revert("StrategyControllerPaused.");
    }

    /**
     * @notice Deposit ETH, which is traded for the underlying assets, and mint strategy tokens
     * @param strategy The address of the strategy being deposited into
     * @param router The address of the router that will be doing the handling the trading logic
     * @param amount The deposit amount as valued in ETH (not used if msg.value > 0)
     * @param data Optional bytes data to be passed if using GenericRouter
     */
    function deposit(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external payable override {
        (strategy, router, amount, slippage, data); // shh compiler
        revert("StrategyControllerPaused.");
    }

    /**
     * @notice Withdraw ETH by trading underling assets for ETH
     * @param strategy The address of the strategy being withdrawn from
     * @param router The address of the router that will be doing the handling the trading logic
     * @param amount The amount of strategy tokens that are being redeemed
     * @param data Optional bytes data to be passed if using GenericRouter
     */
    function withdrawETH(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external override {
        (strategy, router, amount, slippage, data); // shh compiler
        revert("StrategyControllerPaused.");
    }

    /**
     * @notice Withdraw WETH by trading underling assets for WETH
     * @param strategy The address of the strategy being withdrawn from
     * @param router The address of the router that will be doing the handling the trading logic
     * @param amount The amount of strategy tokens that are being redeemed
     * @param data Optional bytes data to be passed if using GenericRouter
     */
    function withdrawWETH(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) external override {
        (strategy, router, amount, slippage, data); // shh compiler
        revert("StrategyControllerPaused.");
    }

    /**
     * @notice Rebalance the strategy to match the current structure
     * @param router The address of the router that will be doing the handling the trading logic
     * @param data Optional bytes data to be passed if using GenericRouter
     */
    function rebalance(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external override {
        (strategy, router, data); // shh compiler
        revert("StrategyControllerPaused.");
    }

    /**
     * @notice Exchange all Synths into or out of sUSD to facilitate rebalancing of the rest of the strategy.
     *         In order to rebalance the strategy, all Synths must first be converted into sUSD
     * @param strategy The address of the strategy being withdrawn from
     * @param adapter The address of the synthetix adapter to handle the exchanging of all synths
     * @param token The token being positioned into. Either sUSD or address(-1) which represents all of the strategy's Synth positions
     */
    function repositionSynths(IStrategy strategy, address adapter, address token) external {
        (strategy, adapter, token); // shh compiler
        revert("StrategyControllerPaused.");
    }

    /**
     * @notice Initiate a restructure of the strategy items. This gives users a chance to withdraw before restructure
     * @dev The strategyItems array is encoded and temporarily stored while the timelock is active
     * @param strategyItems An array of Item structs that will comprise the strategy
     */
    function restructure(
        IStrategy strategy,
        StrategyItem[] memory strategyItems
    ) external override {
        (strategy, strategyItems); // shh compiler
        revert("StrategyControllerPaused.");
    }

    /**
     * @notice Finalize a restructure by setting the new values and trading the strategyItems
     * @dev The strategyItems are decoded and the new structure is set into the strategy
     * @param router The address of the router that will be doing the handling the trading logic
     * @param data Optional bytes data to be sent if using GenericRouter
     */
    function finalizeStructure(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external override {
        (strategy, router, data); // shh compiler
        revert("StrategyControllerPaused.");
    }

    /**
     * @notice Initiate an update of a StrategyState value. This gives users a chance to withdraw before changes are finalized
     * @param category The TimelockCategory of the value we want to change
     * @param newValue The new value that we are updating the state to
     */
    function updateValue(
        IStrategy strategy,
        TimelockCategory category,
        uint256 newValue
    ) external override {
        (strategy, category, newValue); // shh compiler
        revert("StrategyControllerPaused.");
    }

    /**
     * @notice Finalize the value that was set in the timelock
     * @param strategy The address of the strategy that is being updated
     */
    function finalizeValue(IStrategy strategy) external override {
        strategy; // shh compiler
        revert("StrategyControllerPaused.");
    }

    /**
     * @notice Change strategy to 'social'. Cannot be undone.
     * @dev A social profile allows other users to deposit into the strategy
     */
    function openStrategy(IStrategy strategy) external override {
        strategy; // shh compiler
        revert("StrategyControllerPaused.");
    }

    /**
     * @notice Change strategy to 'set'. Cannot be undone.
     * @dev A set strategy cannot be restructured
     */
    function setStrategy(IStrategy strategy) external override {
        strategy; // shh compiler
        revert("StrategyControllerPaused.");
    }

    // @notice Initialized getter
    function initialized(address strategy) public view override returns (bool) {
        return _initialized[strategy] > 0;
    }

    // @notice StrategyState getter
    function strategyState(address strategy) external view override returns (StrategyState memory) {
        return _strategyStates[strategy];
    }

    /**
     * @notice This function verifies that the structure passed in parameters is valid
     * @dev We check that the array lengths match, that the percentages add 100%,
     *      no zero addresses, and no duplicates
     * @dev Token addresses must be passed in, according to increasing byte value
     */
    function verifyStructure(address strategy, StrategyItem[] memory newItems)
        public
        view
        override
        returns (bool)
    {
        require(newItems.length > 0, "Cannot set empty structure");
        require(newItems[0].item != address(0), "Invalid item addr"); //Everything else will caught by the ordering requirement below
        require(newItems[newItems.length-1].item != address(-1), "Invalid item addr"); //Reserved space for virtual item

        ITokenRegistry registry = oracle().tokenRegistry();

        int256 total = 0;
        for (uint256 i = 0; i < newItems.length; i++) {
            address item = newItems[i].item;
            require(i == 0 || newItems[i].item > newItems[i - 1].item, "Item ordering");
            int256 percentage = newItems[i].percentage;
            if (registry.itemCategories(item) == uint256(ItemCategory.DEBT)) {
              require(percentage <= 0, "Debt cannot be positive");
              require(percentage >= -PERCENTAGE_BOUND, "Out of bounds");
            } else {
              require(percentage >= 0, "Token cannot be negative");
              require(percentage <= PERCENTAGE_BOUND, "Out of bounds");
            }
            uint256 category = registry.estimatorCategories(item);
            require(category != uint256(EstimatorCategory.BLOCKED), "Token blocked");
            if (category == uint256(EstimatorCategory.STRATEGY))
                _checkCyclicDependency(strategy, IStrategy(item), registry);
            total = total.add(percentage);
        }
        require(total == int256(DIVISOR), "Total percentage wrong");
        return true;
    }

    /**
        @notice Refresh StrategyController's addresses
     */
    function updateAddresses() public {
        IStrategyProxyFactory f = IStrategyProxyFactory(factory);
        _whitelist = f.whitelist();
        address o = f.oracle();
        if (o != _oracle) {
          IOracle ensoOracle = IOracle(o);
          _oracle = o;
          _weth = ensoOracle.weth();
          _susd = ensoOracle.susd();
        }
    }

    function oracle() public view override returns (IOracle) {
        return IOracle(_oracle);
    }

    function whitelist() public view override returns (IWhitelist) {
        return IWhitelist(_whitelist);
    }

    // Internal Strategy Functions
    /**
     * @notice Deposit eth or weth into strategy
     * @dev Calldata is only needed for the GenericRouter
     */

    function _checkCyclicDependency(address test, IStrategy strategy, ITokenRegistry registry) private view {
        require(address(strategy) != test, "Cyclic dependency");
        require(!strategy.supportsSynths(), "Synths not supported");
        address[] memory strategyItems = strategy.items();
        for (uint256 i = 0; i < strategyItems.length; i++) {
          if (registry.estimatorCategories(strategyItems[i]) == uint256(EstimatorCategory.STRATEGY))
              _checkCyclicDependency(test, IStrategy(strategyItems[i]), registry);
        }
    }

    receive() external payable {
        revert("StrategyControllerPaused.");
    }
}
