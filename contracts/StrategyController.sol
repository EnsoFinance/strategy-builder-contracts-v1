//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/IOracle.sol";
import "./StrategyControllerStorage.sol";

/**
 * @notice This contract controls multiple Strategy contracts.
 * @dev Whitelisted routers are able to execute different swapping strategies as long as total strategy value doesn't drop below the defined slippage amount
 * @dev To avoid someone from repeatedly skimming off this slippage value, threshold should be set sufficiently high
 */
contract StrategyController is IStrategyController, StrategyControllerStorage, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant DIVISOR = 1000;

    event RebalanceCalled(address indexed strategy, uint256 total, address caller);
    event Deposit(address indexed strategy, uint256 value, uint256 amount);
    event NewStructure(address indexed strategy, address[] tokens, uint256[] percentages, bool indexed finalized);
    event NewValue(address indexed strategy, TimelockCategory category, uint256 newValue, bool indexed finalized);

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
     * @param social_ Is the strategy open to others?
     * @param fee_ Strategy performance fee
     * @param threshold_ The percentage out of balance a token must be before it can be rebalanced
     * @param slippage_ The percentage away from 100% that the total can slip during rebalance due to fees
     * @param timelock_ The amount of time between initializing a restructure and updating the strategy
     * @param router_ The router in charge of swapping items for this strategy
     * @param data_ Encoded values parsed by the different routers to execute swaps
     */
    function setupStrategy(
        address creator_,
        address strategy_,
        bool social_,
        uint256 fee_,
        uint256 threshold_,
        uint256 slippage_,
        uint256 timelock_,
        address router_,
        bytes memory data_
    ) external payable override {
        _setLock();
        StrategyState storage strategyState = _strategyStates[strategy_];
        require(strategyState.initialized == false, "Already setup");
        require(msg.sender == _factory, "Not factory");
        require(threshold_ <= DIVISOR && slippage_ <= DIVISOR, "Slippage/threshold high");
        // Set globals
        strategyState.initialized = true;
        strategyState.rebalanceThreshold = uint16(threshold_);
        strategyState.slippage = uint16(slippage_);
        strategyState.timelock = uint32(timelock_);

        IStrategy strategy = IStrategy(strategy_);
        if (msg.value > 0) {
            address weth = IOracle(strategy.oracle()).weth();
            IWETH(weth).deposit{value: msg.value}();
            IERC20(weth).safeApprove(router_, msg.value);
            IStrategyRouter(router_).deposit(strategy_, data_);
            IERC20(weth).approve(router_, 0);
            (uint256 total, ) =
                IOracle(strategy.oracle()).estimateTotal(strategy_, strategy.items());
            require(total > 0, "No value");
            strategy.mint(creator_, total);
        }
        if (social_) {
          _openStrategy(strategy, fee_);
        }
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
        _setLock();
        _onlyApproved(strategy, address(router));
        _onlyManager(strategy);
        (uint256 totalBefore, bool balancedBefore) = _verifyBalance(strategy);
        require(!balancedBefore, "Balanced");
        _approveTokens(strategy, address(router), uint256(-1));
        _rebalance(strategy, router, totalBefore, data);
        _approveTokens(strategy, address(router), uint256(0));
        _removeLock();
    }

    /**
     * @notice Deposit ether, which is traded for the underlying assets, and mint strategy tokens
     * @param strategy The strategy being deposited to
     * @param router The address of the router that will be doing the handling the trading logic
     * @param data The calldata for the router's deposit function
     */
    function deposit(
        IStrategy strategy,
        IStrategyRouter router,
        bytes memory data
    ) external payable override {
        _setLock();
        _onlyApproved(strategy, address(router));
        _socialOrManager(strategy);
        (uint256 totalBefore, ) =
            IOracle(strategy.oracle()).estimateTotal(address(strategy), strategy.items());

        if (msg.value > 0) {
          address weth = IOracle(strategy.oracle()).weth();
          IWETH(weth).deposit{value: msg.value}();
          IERC20(weth).safeApprove(address(router), msg.value);
          router.deposit(address(strategy), data);
          IERC20(weth).safeApprove(address(router), 0);
          require(IERC20(weth).balanceOf(address(this)) == uint256(0), "Leftover funds");
        }  else {
          router.deposit(address(strategy), data);
        }

        // Recheck total
        (uint256 totalAfter, ) =
            IOracle(strategy.oracle()).estimateTotal(address(strategy), strategy.items());
        require(totalAfter > totalBefore, "Lost value");
        uint256 valueAdded = totalAfter - totalBefore; // Safe math not needed, already checking for underflow
        uint256 totalSupply = strategy.totalSupply();
        uint256 relativeTokens =
            totalSupply > 0 ? totalSupply.mul(valueAdded).div(totalBefore) : totalAfter;
        strategy.mint(msg.sender, relativeTokens);
        emit Deposit(address(strategy), msg.value, relativeTokens);
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
            IOracle(strategy.oracle()).estimateTotal(address(strategy), strategy.items());
        uint256 totalSupply = strategy.totalSupply();
        uint256 tokenValue = total.mul(10**18).div(totalSupply);
        StrategyState storage strategyState = _strategyStates[address(strategy)];
        require(tokenValue > strategyState.lastTokenValue, "No earnings");
        uint256 diff = tokenValue.sub(strategyState.lastTokenValue);
        uint256 performanceFee = uint256(strategyState.performanceFee);
        uint256 reward = totalSupply.mul(diff).mul(performanceFee).div(DIVISOR).div(10**18);
        strategyState.lastTokenValue = tokenValue;
        strategy.mint(msg.sender, reward); // _onlyManager() ensures that msg.sender == manager
        _removeLock();
    }

    /**
     * @notice Initiate a restructure of the strategy items. This gives users a chance to withdraw before restructure
     * @dev We store the new structure as a bytes32 hash and then check that the
            values are correct when finalizeStructure is called.
     * @param strategyItems An array of token addresses that will comprise the strategy
     * @param percentages An array of percentages for each token in the above array. Must total 100%
     */
    function restructure(
        IStrategy strategy,
        address[] memory strategyItems,
        uint256[] memory percentages
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
        require(strategy.verifyStructure(strategyItems, percentages), "Invalid structure");
        lock.category = TimelockCategory.RESTRUCTURE;
        lock.timestamp = block.timestamp;
        lock.data = abi.encode(strategyItems, percentages);

        emit NewStructure(address(strategy), strategyItems, percentages, false);
        _removeLock();
    }

    /**
     * @notice Finalize a restructure by setting the new values and trading the strategyItems
     * @dev We confirm that the same structure is sent by checking the bytes32 hash against _restructureProof
     * @param sellAdapters An array of adapters for each sale of the current strategyItems
     * @param buyAdapters An array of adapters for each purchase of the new strategyItems
     * @param router The address of the router that will be doing the handling the trading logic
     */
    function finalizeStructure(
        IStrategy strategy,
        address router,
        address[] memory sellAdapters,
        address[] memory buyAdapters
    ) external override {
        _setLock();
        _onlyManager(strategy);
        StrategyState storage strategyState = _strategyStates[address(strategy)];
        Timelock storage lock = _timelocks[address(strategy)];
        require(
            !strategyState.social ||
                block.timestamp > lock.timestamp.add(uint256(strategyState.timelock)),
            "Timelock active"
        );
        require(lock.category == TimelockCategory.RESTRUCTURE, "Wrong category");
        (address[] memory strategyItems, uint256[] memory percentages) =
            abi.decode(lock.data, (address[], uint256[]));
        _finalizeStructure(strategy, router, strategyItems, percentages, sellAdapters, buyAdapters);
        delete lock.category;
        delete lock.timestamp;
        delete lock.data;
        emit NewStructure(address(strategy), strategyItems, percentages, true);
        _removeLock();
    }

    function updateValue(
        IStrategy strategy,
        uint256 categoryIndex,
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
        TimelockCategory category = TimelockCategory(categoryIndex);
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
        } else { //Only possible option is TimelockCategory.TIMELOCK
            strategyState.timelock = uint32(newValue);
        }
        emit NewValue(strategy, lock.category, newValue, true);
        delete lock.category;
        delete lock.timestamp;
        delete lock.data;
        _removeLock();
    }

    /**
     * @notice Setter to change strategy to social. Cannot be undone.
     * @dev A social profile allows other users to deposit and rebalance the strategy
     */
    function openStrategy(IStrategy strategy, uint256 fee) external override {
        _setLock();
        _onlyManager(strategy);
        _openStrategy(strategy, fee);
        _removeLock();
    }

    /**
     * @notice Initialized getter
     */
     function initialized(address strategy) external view override returns (bool) {
         return _strategyStates[strategy].initialized;
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
        (uint256 totalAfter, bool balancedAfter) = _verifyBalance(strategy);
        require(balancedAfter, "Not balanced");
        require(
            totalAfter >=
                totalBefore.mul(_strategyStates[address(strategy)].slippage).div(DIVISOR),
            "Value slipped"
        );
        emit RebalanceCalled(address(strategy), totalAfter, msg.sender);
        return totalAfter;
    }

    function _openStrategy(IStrategy strategy, uint256 fee) internal {
        require(fee < DIVISOR, "Fee too high");
        (uint256 total, ) =
            IOracle(strategy.oracle()).estimateTotal(address(strategy), strategy.items());
        //As token value increase compared to the _tokenValueLast value, performance fees may be extracted
        StrategyState storage strategyState = _strategyStates[address(strategy)];
        strategyState.lastTokenValue = total.mul(10**18).div(strategy.totalSupply());
        strategyState.performanceFee = uint16(fee);
        strategyState.social = true;
    }

    /**
     * @notice This function gets the strategy value from the oracle and checks
     *         whether the strategy is balanced. Necessary to confirm the balance
     *         before and after a rebalance to ensure nothing fishy happened
     */
    function _verifyBalance(IStrategy strategy) internal view returns (uint256, bool) {
        address[] memory strategyItems = strategy.items();
        (uint256 total, uint256[] memory estimates) =
            IOracle(strategy.oracle()).estimateTotal(address(strategy), strategyItems);
        bool balanced = true;
        for (uint256 i = 0; i < strategyItems.length; i++) {
            uint256 expectedValue = total.mul(strategy.percentage(strategyItems[i])).div(DIVISOR);
            uint256 rebalanceRange =
                expectedValue.mul(_strategyStates[address(strategy)].rebalanceThreshold).div(
                    DIVISOR
                );
            if (estimates[i] > expectedValue.add(rebalanceRange)) {
                balanced = false;
                break;
            }
            if (estimates[i] < expectedValue.sub(rebalanceRange)) {
                balanced = false;
                break;
            }
        }
        return (total, balanced);
    }

    /**
     * @notice Finalize the structure by selling current posiition, setting new structure, and buying new position
     * @param strategyItems An array of token addresses that will comprise the strategy
     * @param percentages An array of percentages for each token in the above array. Must total 100%
     * @param sellAdapters An array of adapters for each sale of the current strategyItems
     * @param buyAdapters An array of adapters for each purchase of the new strategyItems
     * @param router The address of the router that will be doing the handling the trading logic
     */
    function _finalizeStructure(
        IStrategy strategy,
        address router,
        address[] memory strategyItems,
        uint256[] memory percentages,
        address[] memory sellAdapters,
        address[] memory buyAdapters
    ) internal {
        address[] memory currentItems = strategy.items();
        require(sellAdapters.length == currentItems.length, "Sell adapters length");
        require(buyAdapters.length == strategyItems.length, "Buy adapters length");
        IOracle oracle = IOracle(strategy.oracle());
        (uint256 totalBefore, ) = oracle.estimateTotal(address(strategy), currentItems);
        _approveTokens(strategy, router, uint256(-1));
        // Reset all values and return items to ETH
        IStrategyRouter(router).sellTokens(address(strategy), currentItems, sellAdapters);
        _approveTokens(strategy, router, uint256(0));
        // Set new structure
        strategy.setStructure(strategyItems, percentages);
        // Since tokens have already been minted we don't do router.deposit, instead use router.buyTokens
        IERC20 weth = IERC20(IOracle(strategy.oracle()).weth());
        weth.safeApprove(router, uint(-1));
        IStrategyRouter(router).buyTokens(
            address(strategy),
            strategyItems,
            buyAdapters
        );
        weth.safeApprove(router, 0);
        (uint256 totalAfter, ) = oracle.estimateTotal(address(strategy), strategyItems);
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
        address spender,
        uint256 amount
    ) internal {
        strategy.approveTokens(spender, amount);
        address weth = IOracle(strategy.oracle()).weth();
        if (strategy.percentage(weth) == 0) {
            //Approving is still needed as we need to transfer weth for rebalancing
            strategy.approveToken(IERC20(weth), spender, amount);
        }
    }

    /**
     * @notice Checks that router is whitelisted
     */
    function _onlyApproved(IStrategy strategy, address router) internal view {
        require(strategy.isWhitelisted(router), "Router not approved");
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
