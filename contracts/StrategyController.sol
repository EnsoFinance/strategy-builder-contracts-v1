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

    event RebalanceCalled(address indexed strategy, uint256 total, address caller);
    event NewStructure(address indexed strategy, StrategyItem[] items, bool indexed finalized);
    event NewValue(address indexed strategy, TimelockCategory category, uint256 newValue, bool indexed finalized);
    event StrategyOpen(address indexed strategy, uint256 performanceFee);


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
        _setLock();
        require(msg.sender == _factory, "Not factory");
        _setInitialState(strategy_, state_);
        // Deposit
        if (msg.value > 0)
            IStrategy(strategy_).depositFromController{value: msg.value}(
                creator_,
                IStrategyRouter(router_),
                data_
            );
        _removeLock();
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
        strategy.lock();
        _setLock();
        _onlyApproved(address(router));
        _onlyManager(strategy);
        (bool balancedBefore, uint256 totalBefore, int256[] memory estimates) = _verifyBalance(strategy);
        require(!balancedBefore, "Balanced");
        if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
            data = abi.encode(totalBefore, estimates);
        _approveTokens(strategy, strategy.items(), strategy.debt(), address(router), uint256(-1));
        _rebalance(strategy, router, totalBefore, data);
        _approveTokens(strategy, strategy.items(), strategy.debt(), address(router), uint256(0));
        _removeLock();
        strategy.unlock();
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
        _setLock();
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
        _removeLock();
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
        strategy.lock();
        _setLock();
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
        _removeLock();
        strategy.unlock();
    }

    function updateValue(
        IStrategy strategy,
        TimelockCategory category,
        uint256 newValue
    ) external override {
        _setLock();
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
        _removeLock();
    }

    function finalizeValue(address strategy) external override {
        _setLock();
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
        _removeLock();
    }

    /**
     * @notice Manager can withdraw their performance fee here
     * @param strategy The strategy that will be withdrawn from
     */
     function withdrawPerformanceFee(IStrategy strategy) external override {
        _setLock();
        _onlyManager(strategy);
        (uint256 total, ) =
           oracle().estimateStrategy(strategy);
        uint256 totalSupply = strategy.totalSupply();
        uint256 tokenValue = total.mul(10**18).div(totalSupply);
        require(tokenValue > _lastTokenValue[address(strategy)], "No earnings");
        uint256 diff = tokenValue.sub(_lastTokenValue[address(strategy)]);
        uint256 performanceFee = uint256(_strategyStates[address(strategy)].performanceFee);
        uint256 reward = totalSupply.mul(diff).mul(performanceFee).div(DIVISOR).div(10**18);
        _lastTokenValue[address(strategy)] = tokenValue;
        strategy.mint(msg.sender, reward); // _onlyManager() ensures that msg.sender == manager
        _removeLock();
    }

    /**
     * @notice Setter to change strategy to social. Cannot be undone.
     * @dev A social profile allows other users to deposit and rebalance the strategy
     */
    function openStrategy(IStrategy strategy, uint256 fee) external override {
        _setLock();
        _onlyManager(strategy);
        (uint256 total, ) =
            IOracle(strategy.oracle()).estimateStrategy(strategy);
        _openStrategy(strategy, fee, total);
        _removeLock();
    }

    /**
     * @notice Initialized getter
     */
     function initialized(address strategy) external view override returns (bool) {
         return _lastTokenValue[strategy] > 0;
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
            if (EstimatorCategory(registry.estimatorCategories(item)) == EstimatorCategory.STRATEGY)
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
        emit RebalanceCalled(address(strategy), totalAfter, msg.sender);
        return totalAfter;
    }

    function _openStrategy(IStrategy strategy, uint256 fee, uint256 total) internal {
        require(fee < DIVISOR, "Fee too high");
        StrategyState storage strategyState = _strategyStates[address(strategy)];
        require(!strategyState.social, "Strategy already open");
        strategyState.social = true;
        strategyState.performanceFee = uint16(fee);
        //As token value increase compared to the _tokenValueLast value, performance fees may be extracted
        if (total > 0)
            _lastTokenValue[address(strategy)] = total.mul(10**18).div(strategy.totalSupply()); // Value is initially set to 10**18, only change if there is total
        emit StrategyOpen(address(strategy), fee);
    }

    function _setInitialState(address strategy, StrategyState memory state) private {
        require(uint256(state.rebalanceThreshold) <= DIVISOR, "Threshold high");
        require(uint256(state.slippage) <= DIVISOR, "Slippage high");
        require(uint256(state.performanceFee) < DIVISOR, "Fee too high");
        _strategyStates[strategy] = state;
        _lastTokenValue[address(strategy)] = 10**18; //Default starting token value at time of first deposit
        emit NewValue(strategy, TimelockCategory.THRESHOLD, uint256(state.rebalanceThreshold), true);
        emit NewValue(strategy, TimelockCategory.SLIPPAGE, uint256(state.slippage), true);
        emit NewValue(strategy, TimelockCategory.TIMELOCK, uint256(state.timelock), true);
        if (state.social)
            emit StrategyOpen(address(strategy), state.performanceFee);
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
        _approveTokens(strategy, currentItems, currentDebt, address(router), uint256(-1));
        router.restructure(address(strategy), data);
        _approveTokens(strategy, currentItems, currentDebt, address(router), uint256(0));

        (uint256 totalAfter, ) = o.estimateStrategy(strategy);
        require(
            totalAfter >=
                totalBefore.mul(_strategyStates[address(strategy)].slippage).div(DIVISOR),
            "Value slipped"
        );
    }

    /**
     * @notice Batch approve tokens
     * @param spender The address that will be approved to spend tokens
     * @param amount The amount the each token will be approved for
     */
    function _approveTokens(
        IStrategy strategy,
        address[] memory strategyItems,
        address[] memory strategyDebt,
        address spender,
        uint256 amount
    ) internal {
        strategy.approveToken(oracle().weth(), spender, amount);
        if (strategy.supportsSynths()) {
            strategy.approveSynths(spender, amount);
        }
        for (uint256 i = 0; i < strategyItems.length; i++) {
            strategy.approveToken(strategyItems[i], spender, amount);
        }
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            strategy.approveDebt(strategyDebt[i], spender, amount);
        }
    }

    function _checkCyclicDependency(address test, IStrategy strategy, ITokenRegistry registry) internal view returns (bool) {
        require(address(strategy) != test, "Cyclic dependency");
        address[] memory strategyItems = strategy.items();
        for (uint256 i = 0; i < strategyItems.length; i++) {
          EstimatorCategory category = EstimatorCategory(registry.estimatorCategories(strategyItems[i]));
          require(category != EstimatorCategory.SYNTH, "Does not support synths in underlying strategies");
          if (category == EstimatorCategory.STRATEGY)
              _checkCyclicDependency(test, IStrategy(strategyItems[i]), registry);
        }
        return true;
    }

    /**
     * @notice Checks that router is whitelisted
     */
    function _onlyApproved(address router) internal view {
        require(whitelist().approved(router), "Router not approved");
    }

    function _onlyManager(IStrategy strategy) internal view {
        require(msg.sender == strategy.manager(), "Not manager");
    }

    /**
     * @notice Sets Reentrancy guard
     */
    function _setLock() internal {
        require(_locked == 0, "No Reentrancy");
        _locked = 1;
    }

    /**
     * @notice Removes reentrancy guard.
     */
    function _removeLock() internal {
        _locked = 0;
    }
}
