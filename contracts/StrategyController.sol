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
import "./libraries/StrategyLibrary.sol";
import "./StrategyControllerStorage.sol";

/**
 * @notice This contract controls multiple Strategy contracts.
 * @dev Whitelisted routers are able to execute different swapping strategies as long as total strategy value doesn't drop below the defined slippage amount
 * @dev To avoid someone from repeatedly skimming off this slippage value, rebalance threshold should be set sufficiently high
 */
contract StrategyController is IStrategyController, StrategyControllerStorage, Initializable {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;

    enum Action {
        WITHDRAW,
        REBALANCE,
        RESTRUCTURE
    }

    uint256 private constant DIVISOR = 1000;
    int256 private constant PERCENTAGE_BOUND = 10000; // Max 10x leverage

    address public immutable factory;

    event Withdraw(address indexed strategy, address indexed account, uint256 value, uint256 amount);
    event Deposit(address indexed strategy, address indexed account, uint256 value, uint256 amount);
    event Balanced(address indexed strategy, uint256 totalBefore, uint256 totalAfter);
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
        require(msg.sender == factory, "Not factory");
        _setInitialState(strategy_, state_);
        // Deposit
        if (msg.value > 0)
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
        strategy.settleSynths();
        strategy.issueStreamingFee();
        (uint256 totalBefore, int256[] memory estimates) = oracle().estimateStrategy(strategy);
        uint256 balanceBefore = StrategyLibrary.amountOutOfBalance(address(strategy), totalBefore, estimates);
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
        _isInitialized(address(strategy));
        _setStrategyLock(strategy);
        (address weth, uint256 wethAmount) = _withdraw(strategy, router, amount, slippage, data);
        IERC20(weth).safeTransferFrom(address(strategy), address(this), wethAmount);
        IWETH(weth).withdraw(wethAmount);
        (bool success, ) = msg.sender.call{ value : wethAmount }(""); // Using 'call' instead of 'transfer' to safegaurd against gas price increases
        require(success);
        _removeStrategyLock(strategy);
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
        _isInitialized(address(strategy));
        _setStrategyLock(strategy);
        (address weth, uint256 wethAmount) = _withdraw(strategy, router, amount, slippage, data);
        IERC20(weth).safeTransferFrom(address(strategy), msg.sender, wethAmount);
        _removeStrategyLock(strategy);
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
        _onlyApproved(address(router));
        _onlyManager(strategy);
        strategy.settleSynths();
        (bool balancedBefore, uint256 totalBefore, int256[] memory estimates) = StrategyLibrary.verifyBalance(address(strategy), _oracle);
        require(!balancedBefore, "Balanced");
        if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
            data = abi.encode(totalBefore, estimates);
        // Rebalance
        _useRouter(strategy, router, Action.REBALANCE, strategy.items(), strategy.debt(), data);
        // Recheck total
        (bool balancedAfter, uint256 totalAfter, ) = StrategyLibrary.verifyBalance(address(strategy), _oracle);
        require(balancedAfter, "Not balanced");
        _checkSlippage(totalAfter, totalBefore, _strategyStates[address(strategy)].rebalanceSlippage);
        strategy.updateTokenValue(totalAfter, strategy.totalSupply());
        emit Balanced(address(strategy), totalBefore, totalAfter);
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
        strategy.settleSynths();
        address susd = _susd;
        if (token == susd) {
            address[] memory synths = strategy.synths();
            for (uint256 i = 0; i < synths.length; i++) {
                uint256 amount = IERC20(synths[i]).balanceOf(address(strategy));
                if (amount > 0) {
                    strategy.delegateSwap(
                        adapter,
                        amount,
                        synths[i],
                        susd
                    );
                }
            }
        } else if (token == address(-1)) {
            uint256 susdBalance = IERC20(susd).balanceOf(address(strategy));
            int256 percentTotal = strategy.getPercentage(address(-1));
            address[] memory synths = strategy.synths();
            for (uint256 i = 0; i < synths.length; i++) {
                uint256 amount = uint256(int256(susdBalance).mul(strategy.getPercentage(synths[i])).div(percentTotal));
                if (amount > 0) {
                    strategy.delegateSwap(
                        adapter,
                        amount,
                        susd,
                        synths[i]
                    );
                }
            }
        } else {
            revert("Unsupported token");
        }
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
        require(
            lock.timestamp == 0 ||
                block.timestamp >
                lock.timestamp.add(uint256(_strategyStates[address(strategy)].timelock)),
            "Timelock active"
        );
        require(verifyStructure(address(strategy), strategyItems), "Invalid structure");
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
        StrategyState storage strategyState = _strategyStates[address(strategy)];
        Timelock storage lock = _timelocks[address(strategy)];
        require(
            !strategyState.social ||
                block.timestamp > lock.timestamp.add(uint256(strategyState.timelock)),
            "Timelock active"
        );
        require(lock.category == TimelockCategory.RESTRUCTURE, "Wrong category");
        (StrategyItem[] memory strategyItems) =
            abi.decode(lock.data, (StrategyItem[]));
        require(verifyStructure(address(strategy), strategyItems), "Invalid structure");
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
        require(
            lock.timestamp == 0 ||
                block.timestamp >
                lock.timestamp.add(uint256(_strategyStates[address(strategy)].timelock)),
            "Timelock active"
        );
        require(category != TimelockCategory.RESTRUCTURE);
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
        require(lock.category != TimelockCategory.RESTRUCTURE, "Wrong category");
        require(
            !strategyState.social ||
                block.timestamp > lock.timestamp.add(uint256(strategyState.timelock)),
            "Timelock active"
        );
        uint256 newValue = abi.decode(lock.data, (uint256));
        if (lock.category == TimelockCategory.TIMELOCK) {
            strategyState.timelock = uint32(newValue);
        } else if (lock.category == TimelockCategory.REBALANCE_SLIPPAGE) {
            strategyState.rebalanceSlippage = uint16(newValue);
        } else if (lock.category == TimelockCategory.RESTRUCTURE_SLIPPAGE) {
            strategyState.restructureSlippage = uint16(newValue);
        } else if (lock.category == TimelockCategory.THRESHOLD) {
            strategy.updateRebalanceThreshold(uint16(newValue));
        } else { // lock.category == TimelockCategory.PERFORMANCE
            strategy.updatePerformanceFee(uint16(newValue));
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
        require(!strategyState.social, "Strategy already open");
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
        require(!strategyState.set, "Strategy already set");
        strategyState.set = true;
        emit StrategySet(address(strategy));
        _removeStrategyLock(strategy);
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
    function _deposit(
        IStrategy strategy,
        IStrategyRouter router,
        address account,
        uint256 amount,
        uint256 slippage,
        uint256 totalBefore,
        uint256 balanceBefore,
        bytes memory data
    ) internal {
        _onlyApproved(address(router));
        _checkDivisor(slippage);
        _approveSynthsAndDebt(strategy, strategy.debt(), address(router), uint256(-1));
        IOracle o = oracle();
        if (msg.value > 0) {
            require(amount == 0, "Ambiguous amount");
            amount = msg.value;
            address weth = _weth;
            IWETH(weth).deposit{value: amount}();
            IERC20(weth).safeApprove(address(router), amount);
            if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
                data = abi.encode(address(this), amount);
            router.deposit(address(strategy), data);
            IERC20(weth).safeApprove(address(router), 0);
        } else {
            if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
                data = abi.encode(account, amount);
            router.deposit(address(strategy), data);
        }
        _approveSynthsAndDebt(strategy, strategy.debt(), address(router), 0);
        // Recheck total
        (uint256 totalAfter, int256[] memory estimates) = o.estimateStrategy(strategy);
        require(totalAfter > totalBefore, "Lost value");
        StrategyLibrary.checkBalance(address(strategy), balanceBefore, totalAfter, estimates);
        uint256 valueAdded = totalAfter - totalBefore; // Safe math not needed, already checking for underflow
        _checkSlippage(valueAdded, amount, slippage);
        uint256 totalSupply = strategy.totalSupply();
        uint256 relativeTokens =
            totalSupply > 0 ? totalSupply.mul(valueAdded).div(totalBefore) : totalAfter;
        strategy.updateTokenValue(totalAfter, totalSupply.add(relativeTokens));
        strategy.mint(account, relativeTokens);
        emit Deposit(address(strategy), account, amount, relativeTokens);
    }

    /**
     * @notice Trade tokens for weth
     * @dev Calldata is only needed for the GenericRouter
     */
    function _withdraw(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        uint256 slippage,
        bytes memory data
    ) internal returns (address weth, uint256 wethAmount) {
        require(amount > 0, "0 amount");
        _checkDivisor(slippage);
        strategy.settleSynths();
        strategy.issueStreamingFee();
        IOracle o = oracle();
        (uint256 totalBefore, int256[] memory estimatesBefore) = o.estimateStrategy(strategy);
        uint256 balanceBefore = StrategyLibrary.amountOutOfBalance(address(strategy), totalBefore, estimatesBefore);
        {
            uint256 totalSupply = strategy.totalSupply();
            // Deduct fee and burn strategy tokens
            amount = strategy.burn(msg.sender, amount);
            wethAmount = totalBefore.mul(amount).div(totalSupply);
            // Setup data
            if (router.category() != IStrategyRouter.RouterCategory.GENERIC){
                uint256 percentage = amount.mul(10**18).div(totalSupply);
                data = abi.encode(percentage, totalBefore, estimatesBefore);
            }
        }
        // Withdraw
        _useRouter(strategy, router, Action.WITHDRAW, strategy.items(), strategy.debt(), data);
        // Check value and balance
        (uint256 totalAfter, int256[] memory estimatesAfter) = o.estimateStrategy(strategy);
        {
            // Calculate weth amount
            weth = _weth;
            uint256 wethBalance = IERC20(weth).balanceOf(address(strategy));
            uint256 wethAfterSlippage;
            if (totalBefore > totalAfter) {
              uint256 slippageAmount = totalBefore.sub(totalAfter);
              if (slippageAmount > wethAmount) revert("Too much slippage");
              wethAfterSlippage = wethAmount - slippageAmount; // Subtract value loss from weth owed
            } else {
              // Value has increased, no slippage to subtract
              wethAfterSlippage = wethAmount;
            }
            if (wethAfterSlippage > wethBalance) {
                // If strategy's weth balance is less than weth owed, use balance as weth owed
                _checkSlippage(wethBalance, wethAmount, slippage);
                wethAmount = wethBalance;
            } else {
                _checkSlippage(wethAfterSlippage, wethAmount, slippage);
                wethAmount = wethAfterSlippage;
            }
        }
        StrategyLibrary.checkBalance(address(strategy), balanceBefore, totalAfter.sub(wethAmount), estimatesAfter);
        // Approve weth amount
        strategy.approveToken(weth, address(this), wethAmount);
        emit Withdraw(address(strategy), msg.sender, wethAmount, amount);
    }

    function _setInitialState(address strategy, InitialState memory state) private {
        _checkAndEmit(strategy, TimelockCategory.PERFORMANCE, uint256(state.performanceFee), true);
        _checkAndEmit(strategy, TimelockCategory.THRESHOLD, uint256(state.rebalanceThreshold), true);
        _checkAndEmit(strategy, TimelockCategory.REBALANCE_SLIPPAGE, uint256(state.rebalanceSlippage), true);
        _checkAndEmit(strategy, TimelockCategory.RESTRUCTURE_SLIPPAGE, uint256(state.restructureSlippage), true);
        _initialized[strategy] = 1;
        _strategyStates[strategy] = StrategyState(
          state.timelock,
          state.rebalanceSlippage,
          state.restructureSlippage,
          state.social,
          state.set
        );
        IStrategy(strategy).updatePerformanceFee(state.performanceFee);
        IStrategy(strategy).updateRebalanceThreshold(state.rebalanceThreshold);
        if (state.social) emit StrategyOpen(strategy);
        if (state.set) emit StrategySet(strategy);
        emit NewValue(strategy, TimelockCategory.TIMELOCK, uint256(state.timelock), true);
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
        (uint256 totalBefore, int256[] memory estimates) = o.estimateStrategy(strategy);
        // Get current items
        address[] memory currentItems = strategy.items();
        address[] memory currentDebt = strategy.debt();
        // Conditionally set data
        if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
            data = abi.encode(totalBefore, estimates, currentItems, currentDebt);
        // Set new structure
        strategy.setStructure(newItems);
        // Liquidate unused tokens
        _useRouter(strategy, router, Action.RESTRUCTURE, currentItems, currentDebt, data);
        // Check balance
        (bool balancedAfter, uint256 totalAfter, ) = StrategyLibrary.verifyBalance(address(strategy), _oracle);
        require(balancedAfter, "Not balanced");
        _checkSlippage(totalAfter, totalBefore, _strategyStates[address(strategy)].restructureSlippage);
        strategy.updateTokenValue(totalAfter, strategy.totalSupply());
    }

    /**
     * @notice Wrap router function with approve and unapprove
     * @param strategy The strategy contract
     * @param router The router that will be used
     * @param action The action that the router will perform
     * @param strategyItems An array of tokens
     * @param strategyDebt An array of debt tokens
     * @param data The data that will be sent to the router
     */
    function _useRouter(
        IStrategy strategy,
        IStrategyRouter router,
        Action action,
        address[] memory strategyItems,
        address[] memory strategyDebt,
        bytes memory data
    ) internal {
        _approveItems(strategy, strategyItems, strategyDebt, address(router), uint256(-1));
        if (action == Action.WITHDRAW) {
            router.withdraw(address(strategy), data);
        } else if (action == Action.REBALANCE) {
            router.rebalance(address(strategy), data);
        } else if (action == Action.RESTRUCTURE) {
            router.restructure(address(strategy), data);
        }
        _approveItems(strategy, strategyItems, strategyDebt, address(router), uint256(0));
    }

    /**
     * @notice Batch approve items
     * @param strategy The strategy contract
     * @param strategyItems An array of tokens
     * @param strategyDebt An array of debt tokens
     * @param router The router that will be approved to spend tokens
     * @param amount The amount the each token will be approved for
     */
    function _approveItems(
        IStrategy strategy,
        address[] memory strategyItems,
        address[] memory strategyDebt,
        address router,
        uint256 amount
    ) internal {
        strategy.approveToken(_weth, router, amount);
        if (strategyItems.length > 0) strategy.approveTokens(strategyItems, router, amount);
        _approveSynthsAndDebt(strategy, strategyDebt, router, amount);
    }

    /**
     * @notice Batch approve synths and debt
     * @param strategy The strategy contract
     * @param strategyDebt An array of debt tokens
     * @param router The router that will be approved to spend tokens
     * @param amount The amount the each token will be approved for
     */
    function _approveSynthsAndDebt(
        IStrategy strategy,
        address[] memory strategyDebt,
        address router,
        uint256 amount
    ) internal {
        if (strategyDebt.length > 0) strategy.approveDebt(strategyDebt, router, amount);
        if (strategy.supportsDebt()) {
            if (amount == 0) {
                strategy.setRouter(address(0));
            } else {
                strategy.setRouter(router);
            }
        }
        if (strategy.supportsSynths()) strategy.approveSynths(router, amount);
    }

    function _checkCyclicDependency(address test, IStrategy strategy, ITokenRegistry registry) private view {
        require(address(strategy) != test, "Cyclic dependency");
        require(!strategy.supportsSynths(), "Synths not supported");
        address[] memory strategyItems = strategy.items();
        for (uint256 i = 0; i < strategyItems.length; i++) {
          if (registry.estimatorCategories(strategyItems[i]) == uint256(EstimatorCategory.STRATEGY))
              _checkCyclicDependency(test, IStrategy(strategyItems[i]), registry);
        }
    }

    function _checkSlippage(uint256 slippedValue, uint256 referenceValue, uint256 slippage) private pure {
      require(
          slippedValue >= referenceValue.mul(slippage).div(DIVISOR),
          "Too much slippage"
      );
    }

    function _checkDivisor(uint256 value) private pure {
        require(value <= DIVISOR, "Out of bounds");
    }

    function _checkAndEmit(address strategy, TimelockCategory category, uint256 value, bool finalized) private {
        _checkDivisor(value);
        emit NewValue(strategy, category, value, finalized);
    }

    /**
     * @notice Checks that strategy is initialized
     */
    function _isInitialized(address strategy) private view {
        require(initialized(strategy), "Not initialized");
    }

    /**
     * @notice Checks that router is whitelisted
     */
    function _onlyApproved(address account) private view {
        require(whitelist().approved(account), "Not approved");
    }

    /**
     * @notice Checks if msg.sender is manager
     */
    function _onlyManager(IStrategy strategy) private view {
        require(msg.sender == strategy.manager(), "Not manager");
    }

    /**
     * @notice Checks if strategy is social or else require msg.sender is manager
     */
    function _socialOrManager(IStrategy strategy) private view {
        require(
            msg.sender == strategy.manager() || _strategyStates[address(strategy)].social,
            "Not manager"
        );
    }

    function _notSet(address strategy) private view {
        require(!_strategyStates[strategy].set, "Strategy cannot change");
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

    receive() external payable {
        require(msg.sender == _weth, "Not WETH");
    }
}
