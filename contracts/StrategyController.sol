//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/IStrategyProxyFactory.sol";
import "./libraries/StrategyLibrary.sol";
import "./StrategyControllerStorage.sol";

/**
 * @notice This contract controls multiple Strategy contracts.
 * @dev Whitelisted routers are able to execute different swapping strategies as long as total strategy value doesn't drop below the defined slippage amount
 * @dev To avoid someone from repeatedly skimming off this slippage value, threshold should be set sufficiently high
 */
contract StrategyController is IStrategyController, StrategyControllerStorage, Initializable {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;

    uint256 private constant DIVISOR = 1000;

    event Withdraw(address indexed strategy, uint256 value, uint256 amount);
    event Deposit(address indexed strategy, uint256 value, uint256 amount);
    event Balanced(address indexed strategy, uint256 total, address caller);
    event NewStructure(address indexed strategy, StrategyItem[] items, bool indexed finalized);
    event NewValue(address indexed strategy, TimelockCategory category, uint256 newValue, bool indexed finalized);
    event StrategyOpen(address indexed strategy, uint256 performanceFee);
    event StrategySet(address indexed strategy);

    // Initialize constructor to disable implementation
    constructor() public initializer {}

    /**
     * @dev Called to initialize proxy
     * @param factory The address of the StrategyProxyFactory
     */
    function initialize(address factory) external initializer returns (bool) {
        _factory = factory;
    }

    /**
     * @dev Called during the creation of a new Strategy proxy (see: StrategyProxyFactory.createStrategy())
     * @param creator_ The address that created the strategy
     * @param strategy_ The address of the strategy
     * @param state_ The strategy state variables
     * @param router_ The router in charge of swapping items for this strategy
     * @param data_ Encoded values parsed by the different routers to execute swaps
     */
    function setupStrategy(
        address creator_,
        address strategy_,
        StrategyState memory state_,
        address router_,
        bytes memory data_
    ) external payable override {
        IStrategy strategy = IStrategy(strategy_);
        _setStrategyLock(strategy);
        require(msg.sender == _factory, "Not factory");
        _setInitialState(strategy_, state_);
        // Deposit
        if (msg.value > 0)
            _deposit(
                strategy,
                IStrategyRouter(router_),
                creator_,
                0,
                0,
                uint256(-1),
                data_
            );
        _removeStrategyLock(strategy);
    }

    /**
     * @notice Deposit ether, which is traded for the underlying assets, and mint strategy tokens
     * @param router The address of the router that will be doing the handling the trading logic
     * @param data The calldata for the router's deposit function
     */
    function deposit(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        bytes memory data
    ) external payable override {
        _setStrategyLock(strategy);
        _socialOrManager(strategy);
        strategy.withdrawStreamingFee();
        (uint256 totalBefore, int256[] memory estimates) = oracle().estimateStrategy(strategy);
        uint256 balanceBefore = _amountOutOfBalance(strategy, totalBefore, estimates);
        _deposit(strategy, router, msg.sender, amount, totalBefore, balanceBefore, data);
        _removeStrategyLock(strategy);
    }

    function withdraw(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 amount,
        bytes memory data
    ) external override {
        _setStrategyLock(strategy);
        require(amount > 0, "0 amount");
        IOracle o = oracle();
        (uint256 totalBefore, int256[] memory estimatesBefore) = o.estimateStrategy(strategy);
        uint256 balanceBefore = _amountOutOfBalance(strategy, totalBefore, estimatesBefore);
        uint256 totalSupply = strategy.totalSupply();
        // Deduct fee and burn strategy tokens
        amount = strategy.burn(msg.sender, amount);
        {
          uint256 percentage = amount.mul(10**18).div(totalSupply);
          // Setup data
          if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
              data = abi.encode(percentage, totalBefore, estimatesBefore);
          // Approve items
          _approveItems(strategy, strategy.items(), address(router), uint256(-1));
          _approveSynthsAndDebt(strategy, strategy.debt(), address(router), uint256(-1));
          // Withdraw
          router.withdraw(address(strategy), data);
          // Revoke items approval
          _approveItems(strategy, strategy.items(), address(router), uint256(0));
          _approveSynthsAndDebt(strategy, strategy.debt(), address(router), uint256(0));
        }

        StrategyState storage strategyState = _strategyStates[address(strategy)];
        (uint256 totalAfter, int256[] memory estimatesAfter) = o.estimateStrategy(strategy);
        require(
            totalAfter >=
                totalBefore.mul(strategyState.slippage).div(DIVISOR),
            "Too much slippage"
        );
        uint256 withdrawnWeth = totalBefore.mul(amount).div(totalSupply).sub(totalBefore.sub(totalAfter)); // remove slippage from expected weth
        address weth = o.weth();
        strategy.approveToken(weth, address(this), withdrawnWeth);
        IERC20(weth).safeTransferFrom(address(strategy), msg.sender, withdrawnWeth);
        _checkBalance(strategy, balanceBefore, totalAfter.sub(withdrawnWeth), estimatesAfter);
        emit Withdraw(address(strategy), withdrawnWeth, amount);
        _removeStrategyLock(strategy);
    }

    /**
     * @notice Rebalance the strategy to match the current structure
     * @dev The calldata that gets passed to this function can differ depending on which router is being used
     * @param router The address of the router that will be doing the handling the trading logic
     * @param data Calldata that gets passed the the router's rebalance function
     */
    function rebalance(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external override {
        _setStrategyLock(strategy);
        _onlyApproved(address(router));
        _onlyManager(strategy);
        (bool balancedBefore, uint256 totalBefore, int256[] memory estimates) = _verifyBalance(strategy);
        require(!balancedBefore, "Balanced");
        if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
            data = abi.encode(totalBefore, estimates);
        _approveItems(strategy, strategy.items(), address(router), uint256(-1));
        _approveSynthsAndDebt(strategy, strategy.debt(), address(router), uint256(-1));
        _rebalance(strategy, router, totalBefore, data);
        _approveItems(strategy, strategy.items(), address(router), uint256(0));
        _approveSynthsAndDebt(strategy, strategy.debt(), address(router), uint256(0));
        _removeStrategyLock(strategy);
    }

    function settleSynths(IStrategy strategy, address adapter, address token) external {
        _setStrategyLock(strategy);
        _onlyManager(strategy);
        address susd = oracle().susd();
        if (token == susd) {
            address[] memory synths = strategy.synths();
            for (uint256 i = 0; i < synths.length; i++) {
                strategy.delegateSwap(
                    adapter,
                    IERC20(synths[i]).balanceOf(address(strategy)),
                    synths[i],
                    susd
                );
            }
        } else if (token == address(-1)) {
            uint256 susdBalance = IERC20(susd).balanceOf(address(strategy));
            int256 percentTotal = strategy.getPercentage(address(-1));
            address[] memory synths = strategy.synths();
            for (uint256 i = 0; i < synths.length; i++) {
                strategy.delegateSwap(
                    adapter,
                    uint256(int256(susdBalance).mul(strategy.getPercentage(synths[i])).div(percentTotal)),
                    susd,
                    synths[i]
                );
            }
        } else {
            revert("Unsupported token");
        }
        _removeStrategyLock(strategy);
    }

    /**
     * @notice Initiate a restructure of the strategy items. This gives users a chance to withdraw before restructure
     * @dev We store the new structure as a bytes32 hash and then check that the
            values are correct when finalizeStructure is called.
     * @param strategyItems An array of Item structs that will comprise the strategy
     */
    function restructure(
        IStrategy strategy,
        StrategyItem[] memory strategyItems
    ) external override {
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
     * @dev We confirm that the same structure is sent by checking the bytes32 hash against _restructureProof
     * @param router The address of the router that will be doing the handling the trading logic
     * @param data Calldata for the router's restructure function
     */
    function finalizeStructure(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external override {
        _notSet(address(strategy));  // Set strategies cannot restructure
        _setStrategyLock(strategy);
        _onlyApproved(address(router));
        _onlyManager(strategy);
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
        _finalizeStructure(strategy, router, strategyItems, data);
        delete lock.category;
        delete lock.timestamp;
        delete lock.data;
        emit NewStructure(address(strategy), strategyItems, true);
        _removeStrategyLock(strategy);
    }

    function updateValue(
        IStrategy strategy,
        TimelockCategory category,
        uint256 newValue
    ) external override {
        _setStrategyLock(strategy);
        _onlyManager(strategy);
        Timelock storage lock = _timelocks[address(strategy)];
        require(
            lock.timestamp == 0 ||
                block.timestamp >
                lock.timestamp.add(uint256(_strategyStates[address(strategy)].timelock)),
            "Timelock active"
        );
        //TimelockCategory category = TimelockCategory(categoryIndex);
        require(category != TimelockCategory.RESTRUCTURE);
        if (category != TimelockCategory.TIMELOCK)
            require(newValue <= DIVISOR, "Value too high");
        lock.category = category;
        lock.timestamp = block.timestamp;
        lock.data = abi.encode(newValue);
        emit NewValue(address(strategy), category, newValue, false);
        _removeStrategyLock(strategy);
    }

    function finalizeValue(address strategy) external override {
        _setStrategyLock(IStrategy(strategy));
        StrategyState storage strategyState = _strategyStates[strategy];
        Timelock storage lock = _timelocks[strategy];
        require(lock.category != TimelockCategory.RESTRUCTURE, "Wrong category");
        require(
            !strategyState.social ||
                block.timestamp > lock.timestamp.add(uint256(strategyState.timelock)),
            "Timelock active"
        );
        uint256 newValue = abi.decode(lock.data, (uint256));
        if (lock.category == TimelockCategory.THRESHOLD) {
            strategyState.rebalanceThreshold = uint16(newValue);
        } else if (lock.category == TimelockCategory.SLIPPAGE) {
            strategyState.slippage = uint16(newValue);
        } else if (lock.category == TimelockCategory.TIMELOCK) {
            strategyState.timelock = uint32(newValue);
        } else { // lock.category == TimelockCategory.PERFORMANCE
            strategyState.performanceFee = uint16(newValue);
        }
        emit NewValue(strategy, lock.category, newValue, true);
        delete lock.category;
        delete lock.timestamp;
        delete lock.data;
        _removeStrategyLock(IStrategy(strategy));
    }

    /**
     * @notice Change strategy to 'social'. Cannot be undone.
     * @dev A social profile allows other users to deposit and rebalance the strategy
     */
    function openStrategy(IStrategy strategy, uint256 fee) external override {
        _setStrategyLock(strategy);
        _onlyManager(strategy);
        require(fee < DIVISOR, "Fee too high");
        StrategyState storage strategyState = _strategyStates[address(strategy)];
        require(!strategyState.social, "Strategy already open");
        strategyState.social = true;
        strategyState.performanceFee = uint16(fee);
        emit StrategyOpen(address(strategy), fee);
        _removeStrategyLock(strategy);
    }

    /**
     * @notice Change strategy to 'set'. Cannot be undone.
     * @dev A set strategy cannot be restructured
     */
    function setStrategy(IStrategy strategy) external override {
        _setStrategyLock(strategy);
        _onlyManager(strategy);
        StrategyState storage strategyState = _strategyStates[address(strategy)];
        require(!strategyState.set, "Strategy already set");
        strategyState.set = true;
        emit StrategySet(address(strategy));
        _removeStrategyLock(strategy);
    }

    /**
     * @notice Initialized getter
     */
     function initialized(address strategy) external view override returns (bool) {
         return _initialized[strategy] > 0;
     }

    /**
     * @notice Social bool getter
     * @dev This value determines whether other account may deposit into this strategy
     */
    function social(address strategy) external view override returns (bool) {
        return _strategyStates[strategy].social;
    }

    /**
     * @notice Rebalance threshold getter
     */
    function rebalanceThreshold(address strategy) external view override returns (uint256) {
        return uint256(_strategyStates[strategy].rebalanceThreshold);
    }

    /**
     * @notice Slippage getter
     */
    function slippage(address strategy) external view override returns (uint256) {
        return uint256(_strategyStates[strategy].slippage);
    }

    /**
     * @notice Timelock getter
     */
    function timelock(address strategy) external view override returns (uint256) {
        return uint256(_strategyStates[strategy].timelock);
    }

    /**
     * @notice Performance fee getter
     */
    function performanceFee(address strategy) external view override returns (uint256) {
        return uint256(_strategyStates[strategy].performanceFee);
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
        require(newItems[0].item != address(0), "Invalid item addr"); //Everything else will caught be the ordering requirement below
        require(newItems[newItems.length-1].item != address(-1), "Invalid item addr"); //Reserved space for virtual item

        ITokenRegistry registry = oracle().tokenRegistry();

        int256 total = 0;
        for (uint256 i = 0; i < newItems.length; i++) {
            address item = newItems[i].item;
            require(i == 0 || newItems[i].item > newItems[i - 1].item, "Item ordering");
            EstimatorCategory category = EstimatorCategory(registry.estimatorCategories(item));
            require(category != EstimatorCategory.BLOCKED, "Token blocked");
            if (category == EstimatorCategory.STRATEGY)
                _checkCyclicDependency(strategy, IStrategy(item), registry);
            total = total.add(newItems[i].percentage);
        }
        require(uint256(total) == DIVISOR, "Total percentage wrong");
        return true;
    }

    function oracle() public view override returns (IOracle) {
        return IOracle(IStrategyProxyFactory(_factory).oracle());
    }

    function whitelist() public view override returns (IWhitelist) {
        return IWhitelist(IStrategyProxyFactory(_factory).whitelist());
    }

    // Internal Strategy Functions
    /**
     * @notice Deposit eth or weth into strategy
     * @dev The calldata that gets passed to this function can differ depending on which router is being used
     */
    function _deposit(
        IStrategy strategy,
        IStrategyRouter router,
        address account,
        uint256 amount,
        uint256 totalBefore,
        uint256 balanceBefore,
        bytes memory data
    ) internal {
        _onlyApproved(address(router));
        _approveSynthsAndDebt(strategy, strategy.debt(), address(router), uint256(-1));
        IOracle o = oracle();
        if (amount == 0) {
          amount = msg.value;
          address weth = o.weth();
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
        _checkBalance(strategy, balanceBefore, totalAfter, estimates);

        uint256 valueAdded = totalAfter - totalBefore; // Safe math not needed, already checking for underflow
        require(
            valueAdded >=
                amount.mul(_strategyStates[address(strategy)].slippage).div(DIVISOR),
            "Value slipped"
        );
        uint256 totalSupply = strategy.totalSupply();
        uint256 relativeTokens =
            totalSupply > 0 ? totalSupply.mul(valueAdded).div(totalBefore) : totalAfter;
        strategy.updateTokenValue(totalAfter);
        strategy.mint(account, relativeTokens);
        emit Deposit(address(strategy), amount, relativeTokens);
    }

    /**
     * @notice Rebalance the strategy to match the current structure
     * @dev The calldata that gets passed to this function can differ depending on which router is being used
     * @param totalBefore The valuation of the strategy before rebalance
     * @param data Calldata that gets passed the the router's rebalance function
     * @param router The address of the router that will be doing the handling the trading logic
     */
    function _rebalance(
        IStrategy strategy,
        IStrategyRouter router,
        uint256 totalBefore,
        bytes memory data
    ) internal returns (uint256) {
        router.rebalance(address(strategy), data);
        // Recheck total
        (bool balancedAfter, uint256 totalAfter, ) = _verifyBalance(strategy);
        require(balancedAfter, "Not balanced");
        require(
            totalAfter >=
                totalBefore.mul(_strategyStates[address(strategy)].slippage).div(DIVISOR),
            "Value slipped"
        );
        strategy.updateTokenValue(totalAfter);
        emit Balanced(address(strategy), totalAfter, msg.sender);
        return totalAfter;
    }

    function _setInitialState(address strategy, StrategyState memory state) private {
        require(uint256(state.rebalanceThreshold) <= DIVISOR, "Threshold high");
        require(uint256(state.slippage) <= DIVISOR, "Slippage high");
        require(uint256(state.performanceFee) < DIVISOR, "Fee too high");
        _initialized[strategy] = 1;
        _strategyStates[strategy] = state;
        emit NewValue(strategy, TimelockCategory.THRESHOLD, uint256(state.rebalanceThreshold), true);
        emit NewValue(strategy, TimelockCategory.SLIPPAGE, uint256(state.slippage), true);
        emit NewValue(strategy, TimelockCategory.TIMELOCK, uint256(state.timelock), true);
        if (state.social) emit StrategyOpen(address(strategy), state.performanceFee);
        if (state.set) emit StrategySet(address(strategy));
    }

    /**
     * @notice This function gets the strategy value from the oracle and checks
     *         whether the strategy is balanced. Necessary to confirm the balance
     *         before and after a rebalance to ensure nothing fishy happened
     */
    function _verifyBalance(IStrategy strategy) internal view returns (bool, uint256, int256[] memory) {
        (uint256 total, int256[] memory estimates) =
            oracle().estimateStrategy(strategy);
        bool balanced = true;
        //TODO: Do we need to check debt? If collateral is in items, it will be off-balance if debt is off-balance
        address[] memory strategyItems = strategy.items();
        for (uint256 i = 0; i < strategyItems.length; i++) {
            int256 expectedValue = StrategyLibrary.getExpectedTokenValue(total, address(strategy), strategyItems[i]);
            if (expectedValue > 0) {
                int256 rebalanceRange = StrategyLibrary.getRange(expectedValue, _strategyStates[address(strategy)].rebalanceThreshold);
                if (estimates[i] > expectedValue.add(rebalanceRange)) {
                    balanced = false;
                    break;
                }
                if (estimates[i] < expectedValue.sub(rebalanceRange)) {
                    balanced = false;
                    break;
                }
            } else {
                // Token has an expected value of 0, so any value can cause the contract
                // to be 'unbalanced' so we need an alternative way to determine balance.
                // Min percent = 0.1%. If token value is above, consider it unbalanced
                if (estimates[i] > StrategyLibrary.getRange(int256(total), 1)) {
                    balanced = false;
                    break;
                }
            }
        }
        return (balanced, total, estimates);
    }

    /**
     * @notice This function gets the strategy value from the oracle and determines
     *         how out of balance the strategy using an absolute value.
     */
    function _amountOutOfBalance(IStrategy strategy, uint256 total, int256[] memory estimates) internal view returns (uint256) {
        if (total == 0) return 0;
        uint256 amountOutOfBalance = 0;
        address[] memory strategyItems = strategy.items();
        for (uint256 i = 0; i < strategyItems.length; i++) {
            int256 expectedValue = StrategyLibrary.getExpectedTokenValue(total, address(strategy), strategyItems[i]);
            if (estimates[i] > expectedValue) {
                amountOutOfBalance = amountOutOfBalance.add(uint256(estimates[i].sub(expectedValue)));
                break;
            }
            if (estimates[i] < expectedValue) {
                amountOutOfBalance = amountOutOfBalance.add(uint256(expectedValue.sub(estimates[i])));
                break;
            }
        }
        address[] memory strategyDebt = strategy.debt();
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            int256 expectedValue = StrategyLibrary.getExpectedTokenValue(total, address(strategy), strategyDebt[i]);
            uint256 index = strategyItems.length + i;
            if (estimates[index] > expectedValue) {
                amountOutOfBalance = amountOutOfBalance.add(uint256(estimates[index].sub(expectedValue)));
                break;
            }
            if (estimates[index] < expectedValue) {
                amountOutOfBalance = amountOutOfBalance.add(uint256(expectedValue.sub(estimates[index])));
                break;
            }
        }
        return (amountOutOfBalance.mul(10**18).div(total));
    }

    /**
     * @notice Finalize the structure by selling current posiition, setting new structure, and buying new position
     * @param strategy The strategy contract
     * @param router The router contract that will handle the trading
     * @param newItems An array of Item structs that will comprise the strategy
     * @param data Calldata for the router's restructure function
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
        _approveItems(strategy, currentItems, address(router), uint256(-1));
        _approveSynthsAndDebt(strategy, currentDebt, address(router), uint256(-1));
        router.restructure(address(strategy), data);
        _approveItems(strategy, currentItems, address(router), uint256(0));
        _approveSynthsAndDebt(strategy, currentDebt, address(router), uint256(0));

        (uint256 totalAfter, ) = o.estimateStrategy(strategy);
        require(
            totalAfter >=
                totalBefore.mul(_strategyStates[address(strategy)].slippage).div(DIVISOR),
            "Value slipped"
        );
        strategy.updateTokenValue(totalAfter);
    }

    /**
     * @notice Batch approve items
     * @param spender The address that will be approved to spend tokens
     * @param amount The amount the each token will be approved for
     */
    function _approveItems(
        IStrategy strategy,
        address[] memory strategyItems,
        address spender,
        uint256 amount
    ) internal {
        strategy.approveToken(oracle().weth(), spender, amount);
        for (uint256 i = 0; i < strategyItems.length; i++) {
            strategy.approveToken(strategyItems[i], spender, amount);
        }
    }

    /**
     * @notice Batch approve synths and debt
     * @param spender The address that will be approved to spend tokens
     * @param amount The amount the each token will be approved for
     */
    function _approveSynthsAndDebt(
        IStrategy strategy,
        address[] memory strategyDebt,
        address spender,
        uint256 amount
    ) internal {
        if (strategy.supportsSynths()) {
            strategy.approveSynths(spender, amount);
        }
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            strategy.approveDebt(strategyDebt[i], spender, amount);
        }
    }

    function _checkBalance(IStrategy strategy, uint256 balanceBefore, uint256 total, int256[] memory estimates) internal view {
        uint256 balanceAfter = _amountOutOfBalance(strategy, total, estimates);
        if (balanceAfter > uint256(10**18).mul(_strategyStates[address(strategy)].rebalanceThreshold).div(DIVISOR))
            require(balanceAfter <= balanceBefore, "Lost balance");
    }

    function _checkCyclicDependency(address test, IStrategy strategy, ITokenRegistry registry) internal view {
        require(address(strategy) != test, "Cyclic dependency");
        address[] memory strategyItems = strategy.items();
        for (uint256 i = 0; i < strategyItems.length; i++) {
          EstimatorCategory category = EstimatorCategory(registry.estimatorCategories(strategyItems[i]));
          require(category != EstimatorCategory.SYNTH, "Synths not supported");
          if (category == EstimatorCategory.STRATEGY)
              _checkCyclicDependency(test, IStrategy(strategyItems[i]), registry);
        }
    }

    /**
     * @notice Checks that router is whitelisted
     */
    function _onlyApproved(address account) internal view {
        require(whitelist().approved(account), "Not approved");
    }

    function _onlyManager(IStrategy strategy) internal view {
        require(msg.sender == strategy.manager(), "Not manager");
    }

    /**
     * @notice Checks if strategy is social or else require msg.sender is manager
     */
    function _socialOrManager(IStrategy strategy) internal view {
        require(
            msg.sender == strategy.manager() || _strategyStates[address(strategy)].social,
            "Not manager"
        );
    }

    function _notSet(address strategy) internal view {
        require(!_strategyStates[strategy].set, "Strategy cannot change");
    }

    /**
     * @notice Sets Reentrancy guard
     */
    function _setStrategyLock(IStrategy strategy) internal {
        require(!strategy.locked(), "No Reentrancy");
        strategy.lock();
    }

    /**
     * @notice Removes reentrancy guard.
     */
    function _removeStrategyLock(IStrategy strategy) internal {
        strategy.unlock();
    }
}
