//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "./libraries/SafeERC20.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/IStrategyProxyFactory.sol";
import "./libraries/ControllerLibrary.sol";
import "./helpers/Require.sol";
import "./StrategyControllerStorage.sol";

/**
 * @notice This contract controls multiple Strategy contracts.
 * @dev Whitelisted routers are able to execute different swapping strategies as long as total strategy value doesn't drop below the defined slippage amount
 * @dev To avoid someone from repeatedly skimming off this slippage value, rebalance threshold should be set sufficiently high
 */
contract StrategyController is IStrategyController, StrategyControllerStorage, Initializable, Require {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;

    uint256 private constant DIVISOR = 1000;
    uint256 private constant PRECISION = 10**18;
    uint256 private constant WITHDRAW_UPPER_BOUND = 10**17; // Upper condition for including pool's tokens as part of burn during withdraw
    uint256 private constant WITHDRAW_LOWER_BOUND = 10**16; // Lower condition for including pool's tokens as part of burn during withdraw
    uint256 private constant FEE_BOUND = 200; // Max fee of 20%
    int256 private constant PERCENTAGE_BOUND = 10000; // Max 10x leverage

    address public immutable factory;

    event NewStructure(address indexed strategy, StrategyItem[] items, bool indexed finalized);
    event NewValue(address indexed strategy, TimelockCategory category, uint256 newValue, bool indexed finalized);
    event StrategyOpen(address indexed strategy);
    event StrategySet(address indexed strategy);

    // Initialize constructor to disable implementation
    constructor(address factory_) public initializer {
        factory = factory_;
    }

    /**
     * @dev Called to initialize proxy
     */
    function initialize() external initializer {
        updateAddresses();
        _require(address(this)== ControllerLibrary.self(), uint256(0x1bb63a90056c00) /* error_macro_for("Sanity check that Library shares context.") */);
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
        IStrategy strategy = IStrategy(strategy_);
        _setStrategyLock(strategy);
        _require(msg.sender == factory, uint256(0x1bb63a90056c01) /* error_macro_for("Not factory") */);
        _setInitialState(strategy_, state_);
        // Deposit
        if (msg.value > 0)
            // No need to issue streaming fees on initial setup
            _deposit(
                strategy,
                IStrategyRouter(router_),
                manager_,
                0,
                state_.restructureSlippage,
                0,
                uint256(-1),
                data_
            );
        _removeStrategyLock(strategy);
    }

    function migrateStrategy(IStrategy strategy, address[] calldata accounts) external override {
        if (address(strategy.token()) == address(0)) strategy.updateToken();
        uint256 accountsLength;
        IStrategyToken token = strategy.token();
        for (uint256 i; i < accountsLength; ++i) {
            strategy.migrateAccount(accounts[i]); 
        }
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
        _isInitialized(address(strategy));
        _setStrategyLock(strategy);
        _socialOrManager(strategy);
        strategy.claimAll();
        Timelock memory lock = _timelocks[address(strategy)];
        _require(
          lock.timestamp == 0 || lock.category != TimelockCategory.RESTRUCTURE,
          uint256(0x1bb63a90056c02) /* error_macro_for("Strategy restructuring") */
        );
        strategy.settleSynths();
        strategy.token().issueStreamingFee();
        (uint256 totalBefore, int256[] memory estimates) = oracle().estimateStrategy(strategy);
        uint256 balanceBefore = ControllerLibrary.amountOutOfBalance(address(strategy), totalBefore, estimates);
        _deposit(strategy, router, msg.sender, amount, slippage, totalBefore, balanceBefore, data);
        _removeStrategyLock(strategy);
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
        (address weth, uint256 wethAmount) = _withdrawWETH(strategy, router, amount, slippage, address(this), data);
        IWETH(weth).withdraw(wethAmount);
        (bool success, ) = msg.sender.call{ value : wethAmount }(""); // Using 'call' instead of 'transfer' to safegaurd against gas price increases
        _require(success, uint256(0x1bb63a90056c03) /* error_macro_for("withdrawETH: call failed.") */);
        _removeStrategyLock(strategy); // locked in _withdrawWETH
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
        _withdrawWETH(strategy, router, amount, slippage, msg.sender, data);
        _removeStrategyLock(strategy); // locked in _withdrawWETH
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
        _isInitialized(address(strategy));
        _setStrategyLock(strategy);
        _onlyManager(strategy);
        ControllerLibrary.rebalance(strategy, router, _oracle, _weth, _strategyStates[address(strategy)].rebalanceSlippage, data);
        _removeStrategyLock(strategy);
    }

    function claimAll(
        IStrategy strategy
    ) external override {
        _isInitialized(address(strategy));
        _setStrategyLock(strategy);
        _onlyManager(strategy);
        strategy.claimAll();
        _removeStrategyLock(strategy);
    }

    /**
     * @notice Exchange all Synths into or out of sUSD to facilitate rebalancing of the rest of the strategy.
     *         In order to rebalance the strategy, all Synths must first be converted into sUSD
     * @param strategy The address of the strategy being withdrawn from
     * @param adapter The address of the synthetix adapter to handle the exchanging of all synths
     * @param token The token being positioned into. Either sUSD or address(-1) which represents all of the strategy's Synth positions
     */
    function repositionSynths(IStrategy strategy, address adapter, address token) external {
        _isInitialized(address(strategy));
        _setStrategyLock(strategy);
        _onlyManager(strategy);
        ControllerLibrary.repositionSynths(strategy, adapter, token, _susd);
        _removeStrategyLock(strategy);
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
        _isInitialized(address(strategy));
        _notSet(address(strategy)); // Set strategies cannot restructure
        _setStrategyLock(strategy);
        _onlyManager(strategy);
        Timelock storage lock = _timelocks[address(strategy)];
        _require(
            lock.timestamp == 0 ||
                block.timestamp >
                lock.timestamp.add(uint256(_strategyStates[address(strategy)].timelock)),
            uint256(0x1bb63a90056c04) /* error_macro_for("Timelock active") */
        );
        _require(ControllerLibrary.verifyStructure(address(strategy), strategyItems), uint256(0x1bb63a90056c05) /* error_macro_for("Invalid structure") */);
        lock.category = TimelockCategory.RESTRUCTURE;
        lock.timestamp = block.timestamp;
        lock.data = abi.encode(strategyItems);

        emit NewStructure(address(strategy), strategyItems, false);
        _removeStrategyLock(strategy);
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
        _isInitialized(address(strategy));
        _notSet(address(strategy));  // Set strategies cannot restructure
        _setStrategyLock(strategy);
        _onlyApproved(address(router));
        _onlyManager(strategy);
        strategy.settleSynths();
        StrategyState memory strategyState = _strategyStates[address(strategy)];
        Timelock storage lock = _timelocks[address(strategy)];
        _require(
            !strategyState.social ||
                block.timestamp >= lock.timestamp.add(uint256(strategyState.timelock)),
            uint256(0x1bb63a90056c06) /* error_macro_for("Timelock active") */
        );
        _require(lock.category == TimelockCategory.RESTRUCTURE, uint256(0x1bb63a90056c07) /* error_macro_for("Wrong category") */);
        (StrategyItem[] memory strategyItems) =
            abi.decode(lock.data, (StrategyItem[]));
        _require(ControllerLibrary.verifyStructure(address(strategy), strategyItems), uint256(0x1bb63a90056c08) /* error_macro_for("Invalid structure") */);
        _finalizeStructure(strategy, router, strategyItems, data);
        delete lock.category;
        delete lock.timestamp;
        delete lock.data;
        emit NewStructure(address(strategy), strategyItems, true);
        _removeStrategyLock(strategy);
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
        _isInitialized(address(strategy));
        _setStrategyLock(strategy);
        _onlyManager(strategy);
        Timelock storage lock = _timelocks[address(strategy)];
        _require(
            lock.timestamp == 0 ||
                block.timestamp >
                lock.timestamp.add(uint256(_strategyStates[address(strategy)].timelock)),
            uint256(0x1bb63a90056c09) /* error_macro_for("Timelock active") */
        );
        _require(category != TimelockCategory.RESTRUCTURE, uint256(0x1bb63a90056c0a) /* error_macro_for("updateValue: category is RESTRUCTURE.") */);
        if (category != TimelockCategory.TIMELOCK) {
            _checkAndEmit(address(strategy), category, newValue, false);
        } else {
            emit NewValue(address(strategy), category, newValue, false);
        }
        lock.category = category;
        lock.timestamp = block.timestamp;
        lock.data = abi.encode(newValue);
        _removeStrategyLock(strategy);
    }

    /**
     * @notice Finalize the value that was set in the timelock
     * @param strategy The address of the strategy that is being updated
     */
    function finalizeValue(IStrategy strategy) external override {
        _isInitialized(address(strategy));
        _setStrategyLock(strategy);
        StrategyState storage strategyState = _strategyStates[address(strategy)];
        Timelock storage lock = _timelocks[address(strategy)];
        _require(lock.category != TimelockCategory.RESTRUCTURE, uint256(0x1bb63a90056c0b) /* error_macro_for("Wrong category") */);
        _require(
            !strategyState.social ||
                block.timestamp >= lock.timestamp.add(uint256(strategyState.timelock)),
            uint256(0x1bb63a90056c0c) /* error_macro_for("Timelock active") */
        );
        uint256 newValue = abi.decode(lock.data, (uint256));
        if (lock.category == TimelockCategory.TIMELOCK) {
            strategyState.timelock = uint32(newValue);
        } else if (lock.category == TimelockCategory.REBALANCE_SLIPPAGE) {
            strategyState.rebalanceSlippage = uint16(newValue);
        } else if (lock.category == TimelockCategory.RESTRUCTURE_SLIPPAGE) {
            strategyState.restructureSlippage = uint16(newValue);
        } else if (lock.category == TimelockCategory.REBALANCE_THRESHOLD) {
            strategy.updateRebalanceThreshold(uint16(newValue));
        } else if (lock.category == TimelockCategory.PERFORMANCE_FEE) {
            strategy.token().updatePerformanceFee(uint16(newValue));
        } else { // lock.category == TimelockCategory.MANAGEMENT_FEE
            strategy.token().updateManagementFee(uint16(newValue));
        }
        emit NewValue(address(strategy), lock.category, newValue, true);
        delete lock.category;
        delete lock.timestamp;
        delete lock.data;
        _removeStrategyLock(strategy);
    }

    /**
     * @notice Change strategy to 'social'. Cannot be undone.
     * @dev A social profile allows other users to deposit into the strategy
     */
    function openStrategy(IStrategy strategy) external override {
        _isInitialized(address(strategy));
        _setStrategyLock(strategy);
        _onlyManager(strategy);
        StrategyState storage strategyState = _strategyStates[address(strategy)];
        _require(!strategyState.social, uint256(0x1bb63a90056c0d) /* error_macro_for("Strategy already open") */);
        strategyState.social = true;
        emit StrategyOpen(address(strategy));
        _removeStrategyLock(strategy);
    }

    /**
     * @notice Change strategy to 'set'. Cannot be undone.
     * @dev A set strategy cannot be restructured
     */
    function setStrategy(IStrategy strategy) external override {
        _isInitialized(address(strategy));
        _setStrategyLock(strategy);
        _onlyManager(strategy);
        StrategyState storage strategyState = _strategyStates[address(strategy)];
        _require(!strategyState.set, uint256(0x1bb63a90056c0e) /* error_macro_for("Strategy already set") */);
        strategyState.set = true;
        emit StrategySet(address(strategy));
        _removeStrategyLock(strategy);
    }

    function verifyStructure(address strategy, StrategyItem[] memory newItems)
        public
        view
        override
        returns (bool)
    {
        return ControllerLibrary.verifyStructure(strategy, newItems);
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
        @notice Refresh StrategyController's addresses
     */
    function updateAddresses() public {
        IStrategyProxyFactory f = IStrategyProxyFactory(factory);
        _whitelist = f.whitelist();
        _pool = f.pool();
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

    function weth() external view override returns(address) {
        return _weth;
    }

    function pool() external view override returns(address) {
        return _pool;
    }

    function _withdrawWETH(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        address to,
        bytes memory data
    ) private returns(address weth, uint256 wethAmount) {
        _isInitialized(address(strategy));
        _setStrategyLock(strategy);
        (weth, wethAmount) = ControllerLibrary.withdraw(strategy, router, amount, slippage, data);
        IERC20(weth).safeTransferFrom(address(strategy), to, wethAmount);
    }

    function _setInitialState(address strategy, InitialState memory state) private {
        _checkAndEmit(strategy, TimelockCategory.MANAGEMENT_FEE, uint256(state.managementFee), true);
        _checkAndEmit(strategy, TimelockCategory.REBALANCE_THRESHOLD, uint256(state.rebalanceThreshold), true);
        _checkAndEmit(strategy, TimelockCategory.REBALANCE_SLIPPAGE, uint256(state.rebalanceSlippage), true);
        _checkAndEmit(strategy, TimelockCategory.RESTRUCTURE_SLIPPAGE, uint256(state.restructureSlippage), true);
        _require(state.timelock <= 30 days, uint256(0x1bb63a90056c0f) /* error_macro_for("Timelock is too long") */);
        _initialized[strategy] = 1;
        _strategyStates[strategy] = StrategyState(
          state.timelock,
          state.rebalanceSlippage,
          state.restructureSlippage,
          state.social,
          state.set
        );
        IStrategy(strategy).token().updateManagementFee(state.managementFee);
        IStrategy(strategy).updateRebalanceThreshold(state.rebalanceThreshold);
        if (state.social) emit StrategyOpen(strategy);
        if (state.set) emit StrategySet(strategy);
        emit NewValue(strategy, TimelockCategory.TIMELOCK, uint256(state.timelock), true);
    }

    function _deposit(
        IStrategy strategy,
        IStrategyRouter router,
        address account,
        uint256 amount,
        uint256 slippage,
        uint256 totalBefore,
        uint256 balanceBefore,
        bytes memory data
    ) private {
        address weth;
        if (msg.value > 0) {
            _require(amount == 0, uint256(0x1bb63a90056c10) /* error_macro_for("Ambiguous amount") */);
            amount = msg.value;
            weth = _weth;
            IWETH(weth).deposit{value: amount}();
        }
        ControllerLibrary.deposit(strategy, router, account, amount, slippage, totalBefore, balanceBefore, weth, data);
    }

    /**
     * @notice Finalize the structure by selling current posiition, setting new structure, and buying new position
     * @param strategy The strategy contract
     * @param router The router contract that will handle the trading
     * @param newItems An array of Item structs that will comprise the strategy
     * @param data Optional bytes data to be sent if using GenericRouter
     */
    function _finalizeStructure(
        IStrategy strategy,
        IStrategyRouter router,
        StrategyItem[] memory newItems,
        bytes memory data
    ) internal {
        // Get strategy value
        IOracle o = oracle();
        strategy.claimAll(); // from the old structure
        (uint256 totalBefore, int256[] memory estimates) = o.estimateStrategy(strategy);
        // Get current items
        address[] memory currentItems = strategy.items();
        address[] memory currentDebt = strategy.debt();
        // Conditionally set data
        if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
            data = abi.encode(totalBefore, estimates, currentItems, currentDebt);
        // Set new structure
        strategy.setStructure(newItems);
        strategy.claimAll(); // from the new structure
        // Liquidate unused tokens
        ControllerLibrary.useRouter(strategy, router, router.restructure, _weth, currentItems, currentDebt, data);
        // Check balance
        (bool balancedAfter, uint256 totalAfter, ) = ControllerLibrary.verifyBalance(address(strategy), _oracle);
        _require(balancedAfter, uint256(0x1bb63a90056c11) /* error_macro_for("Not balanced") */);
        _checkSlippage(totalAfter, totalBefore, _strategyStates[address(strategy)].restructureSlippage);
        IStrategyToken t = strategy.token();
        t.updateTokenValue(totalAfter, t.totalSupply());
    }

    function _checkSlippage(uint256 slippedValue, uint256 referenceValue, uint256 slippage) private pure {
      _require(
          slippedValue >= referenceValue.mul(slippage).div(DIVISOR),
          uint256(0x1bb63a90056c12) /* error_macro_for("Too much slippage") */
      );
    }

    function _checkDivisor(uint256 value) private pure {
        _require(value <= DIVISOR, uint256(0x1bb63a90056c13) /* error_macro_for("Out of bounds") */);
    }

    function _checkFee(uint256 value) private pure {
        _require(value <= FEE_BOUND, uint256(0x1bb63a90056c14) /* error_macro_for("Fee too high") */);
    }

    function _checkAndEmit(address strategy, TimelockCategory category, uint256 value, bool finalized) private {
        if (uint256(category) > 4) {
            _checkFee(value);
        } else {
            _checkDivisor(value);
        }
        emit NewValue(strategy, category, value, finalized);
    }

    /**
     * @notice Sets Reentrancy guard
     */
    function _setStrategyLock(IStrategy strategy) private {
        strategy.lock();
    }

    /**
     * @notice Removes reentrancy guard.
     */
    function _removeStrategyLock(IStrategy strategy) private {
        strategy.unlock();
    }

    /**
     * @notice Checks that strategy is initialized
     */
    function _isInitialized(address strategy) private view {
        _require(initialized(strategy), uint256(0x1bb63a90056c15) /* error_macro_for("Not initialized") */);
    }

    /**
     * @notice Checks that router is whitelisted
     */
    function _onlyApproved(address account) private view {
        _require(whitelist().approved(account), uint256(0x1bb63a90056c16) /* error_macro_for("Not approved") */);
    }

    /**
     * @notice Checks if msg.sender is manager
     */
    function _onlyManager(IStrategy strategy) private view {
        _require(msg.sender == strategy.manager(), uint256(0x1bb63a90056c17) /* error_macro_for("Not manager") */);
    }

    /**
     * @notice Checks if strategy is social or else _require msg.sender is manager
     */
    function _socialOrManager(IStrategy strategy) private view {
        _require(
            msg.sender == strategy.manager() || _strategyStates[address(strategy)].social,
            uint256(0x1bb63a90056c18) /* error_macro_for("Not manager") */
        );
    }

    function _notSet(address strategy) private view {
        _require(!_strategyStates[strategy].set, uint256(0x1bb63a90056c19) /* error_macro_for("Strategy cannot change") */);
    }

    receive() external payable {
        _require(msg.sender == _weth, uint256(0x1bb63a90056c1a) /* error_macro_for("Not WETH") */);
    }
}
