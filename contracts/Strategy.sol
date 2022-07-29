//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "./libraries/SafeERC20.sol";
import "./libraries/StrategyClaim.sol";
import "./libraries/MemoryMappings.sol";
import "./libraries/BinaryTree.sol";
import "./interfaces/IOracle.sol";
import "./interfaces/IBaseAdapter.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IStrategyManagement.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/synthetix/IDelegateApprovals.sol";
import "./interfaces/synthetix/IExchanger.sol";
import "./interfaces/synthetix/IIssuer.sol";
import "./interfaces/aave/ILendingPool.sol";
import "./interfaces/aave/IDebtToken.sol";
import "./helpers/Timelocks.sol";
import "./helpers/Require.sol";
import "./StrategyTokenFees.sol";

interface ISynthetixAddressResolver {
    function getAddress(bytes32 name) external returns (address);
}

interface IAaveAddressResolver {
    function getLendingPool() external returns (address);
}

/**
 * @notice This contract holds erc20 tokens, and represents individual account holdings with an erc20 strategy token
 * @dev Strategy token holders can withdraw their assets here or in StrategyController
 */
contract Strategy is IStrategy, IStrategyManagement, StrategyTokenFees, Initializable, Timelocks, Require {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;
    using MemoryMappings for BinaryTree.Tree;

    ISynthetixAddressResolver private immutable synthetixResolver;
    IAaveAddressResolver private immutable aaveResolver;

    event Withdraw(address indexed account, uint256 amount, uint256[] amounts);
    event UpdateManager(address manager);
    event UpdateTradeData(address item, bool finalized);
    event ClaimablesUpdated();
    event RewardsUpdated();

    // Initialize constructor to disable implementation
    constructor(address factory_, address controller_, address synthetixResolver_, address aaveResolver_) public initializer StrategyCommon(factory_, controller_) {
        synthetixResolver = ISynthetixAddressResolver(synthetixResolver_);
        aaveResolver = IAaveAddressResolver(aaveResolver_);
    }

    /**
     * @notice Initializes new Strategy
     * @dev Should be called from the StrategyProxyFactory  (see StrategyProxyFactory._createProxy())
     */
    function initialize(
        string calldata name_,
        string calldata symbol_,
        string calldata version_,
        address manager_,
        StrategyItem[] memory strategyItems_
    ) external override initializer returns (bool) {
        _manager = manager_;
        _name = name_;
        _symbol = symbol_;
        _version = version_;
        _lastTokenValue = uint128(PRECISION);
        _lastStreamTimestamp = uint96(block.timestamp);
        _paidTokenValues[manager_] = uint256(-1);
        _setDomainSeperator();
        updateAddresses();
        // Set structure
        if (strategyItems_.length != 0) {
            IStrategyController(_controller).verifyStructure(address(this), strategyItems_);
            _setStructure(strategyItems_);
        }
        return true;
    }

    /**
     * @notice Strategy gives a token approval to another account. Only called by controller
     * @param token The address of the ERC-20 token
     * @param account The address of the account to be approved
     * @param amount The amount to be approved
     */
    function approveToken(
        address token,
        address account,
        uint256 amount
    ) external override {
        _onlyController();
        IERC20(token).sortaSafeApprove(account, amount);
    }

    /**
     * @notice Strategy gives a token approval to another account. Only called by controller
     * @param tokens The addresses of the ERC-20 tokens
     * @param account The address of the account to be approved
     * @param amount The amount to be approved
     */
    function approveTokens(
        address[] calldata tokens,
        address account,
        uint256 amount
    ) external override {
        _onlyController();
        uint256 length = tokens.length;
        for (uint256 i; i < length; ++i) {
            IERC20(tokens[i]).sortaSafeApprove(account, amount);
        }
    }

    /**
     * @notice Strategy approves another account to take out debt. Only called by controller
     * @param tokens The addresses of the Aave DebtTokens
     * @param account The address of the account to be approved
     * @param amount The amount to be approved
     */
    function approveDebt(
        address[] calldata tokens,
        address account,
        uint256 amount
    ) external override {
        _onlyController();
        uint256 length = tokens.length;
        for (uint256 i; i < length; ++i) {
            IDebtToken(tokens[i]).approveDelegation(account, amount);
        }
    }

    /**
     * @notice Strategy gives approves another account to trade its Synths. Only called by controller
     * @param account The address of the account to be approved
     * @param amount The amount to be approved (in this case its a binary choice -- 0 removes approval)
     */
    function approveSynths(
        address account,
        uint256 amount
    ) external override {
        _onlyController();
        IERC20(_susd).sortaSafeApprove(account, amount);
        IDelegateApprovals delegateApprovals = IDelegateApprovals(synthetixResolver.getAddress("DelegateApprovals"));
        if (amount == 0) {
            delegateApprovals.removeExchangeOnBehalf(account);
        } else {
            delegateApprovals.approveExchangeOnBehalf(account);
        }
    }

    /**
     * @notice Set the structure of the strategy
     * @param newItems An array of Item structs that will comprise the strategy
     */
    function setStructure(StrategyItem[] memory newItems)
        external
        override
    {
        _onlyController();
        StrategyClaim.claimAll(_claimables);
        _setStructure(newItems);
    }

    function setRouter(address router) external override {
        _onlyController();
        _tempRouter = router;
    }

    function updateTimelock(bytes4 selector, uint256 delay) external {
        _onlyManager();
        _startTimelock(
          keccak256(abi.encode(this.updateTimelock.selector)), // identifier
          abi.encode(keccak256(abi.encode(selector)), delay)); // payload
        emit UpdateTimelock(delay, false);
    }

    function finalizeTimelock() external {
        bytes32 key = keccak256(abi.encode(this.updateTimelock.selector));
        if (!_timelockIsReady(key)) {
            TimelockData memory td = _timelockData(key);
            _require(td.delay == 0, uint256(0xb3e5dea2190e00) /* error_macro_for("finalizeTimelock: timelock is not ready.") */);
        }
        bytes memory value = _getTimelockValue(key);
        require(value.length != 0, "timelock never started.");
        (bytes32 identifier, uint256 delay) = abi.decode(value, (bytes32, uint256));
        _setTimelock(identifier, delay);
        _resetTimelock(key);
        emit UpdateTimelock(delay, true);
    }

    function setCollateral(address token) external override {
        _require(msg.sender == _tempRouter, uint256(0xb3e5dea2190e01) /* error_macro_for("Router only") */);
        ILendingPool(aaveResolver.getLendingPool()).setUserUseReserveAsCollateral(token, true);
    }

    /**
    * @notice Withdraw the underlying assets and burn the equivalent amount of strategy token
    * @param amount The amount of strategy tokens to burn to recover the equivalent underlying assets
    */
    function withdrawAll(uint256 amount) external override {
        _setLock();
        _require(_debt.length == 0, uint256(0xb3e5dea2190e02) /* error_macro_for("Cannot withdraw debt") */);
        _require(amount != 0, uint256(0xb3e5dea2190e03) /* error_macro_for("0 amount") */);
        settleSynths();
        uint256 percentage;
        {
            // Deduct withdrawal fee, burn tokens, and calculate percentage
            uint256 totalSupplyBefore = _totalSupply; // Need to get total supply before burn to properly calculate percentage
            _issueStreamingFeeAndBurn(_pool, _manager, msg.sender, amount);
            percentage = amount.mul(PRECISION).div(totalSupplyBefore);
        }
        // Calculate amounts owed
        (IERC20[] memory tokens, uint256[] memory amounts) = StrategyClaim.getWithdrawAmounts(
            percentage, _items, _synths, IERC20(_weth), IERC20(_susd)
        );
        // Transfer amounts
        uint256 length = tokens.length;
        for (uint256 i; i < length; ++i) {
            if (amounts[i] != 0) tokens[i].safeTransfer(msg.sender, amounts[i]);
        }
        emit Withdraw(msg.sender, amount, amounts);
        _removeLock();
    }

    /**
     * @notice Mint new tokens. Only callable by controller
     * @param account The address of the account getting new tokens
     * @param amount The amount of tokens being minted
     */
    function mint(address account, uint256 amount) external override {
        _onlyController();
        // Normally we would expect to call _issueStreamingFee here, but since an accurate totalSupply
        // is needed to determine the mint amount, it is called earlier in StrategyController.deposit()
        // so it unnecessary to call here.
        address pool = _pool;
        address manager = _manager;
        if (account != manager && account != pool) _updatePaidTokenValue(account, amount, _lastTokenValue);
        _mint(account, amount);
        _updateStreamingFeeRate(pool, manager);
    }

    /**
     * @notice Burn tokens. Only callable by controller
     * @param account The address of the account getting tokens removed
     * @param amount The amount of tokens being burned
     */
    function burn(address account, uint256 amount) external override returns (uint256) {
        _onlyController();
        address pool = _pool;
        if (account == pool) {
          _burn(account, amount);
        } else {
          address manager = _manager;
          if (account != manager) _removePaidTokenValue(account, amount);
          _issueStreamingFeeAndBurn(pool, manager, account, amount);
        }
        return amount;
    }

    /**
     * @notice Swap tokens directly from this contract using a delegate call to an adapter. Only callable by controller
     * @param adapter The address of the adapter that this function does a delegate call to. It must support the IBaseAdapter interface and be whitelisted
     * @param amount The amount of tokenIn tokens that are being exchanged
     * @param tokenIn The address of the token that is being sent
     * @param tokenOut The address of the token that is being received
     */
    function delegateSwap(
        address adapter,
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external override {
        _onlyController();
        // Note: No reentrancy lock or whitelist check since only callable by
        //       repositionSynths function in controller which already locks and
        //       checks that adapter is approved.
        bytes memory swapData =
            abi.encodeWithSelector(
                IBaseAdapter.swap.selector,
                amount,
                1,
                tokenIn,
                tokenOut,
                address(this),
                address(this)
            );
        uint256 txGas = gasleft();
        bool success;
        assembly {
            success := delegatecall(txGas, adapter, add(swapData, 0x20), mload(swapData), 0, 0)
        }
        if (!success) {
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
    }

    function factory() external view override returns(address) {
        return _factory;
    }

    function getAllRewardTokens() external view returns(address[] memory rewardTokens) {
        ITokenRegistry tokenRegistry = ITokenRegistry(IStrategyProxyFactory(_factory).tokenRegistry());
        return StrategyClaim.getAllRewardTokens(tokenRegistry);
    }

    // claim all rewards tokens of claimables
    function claimAll() external override {
        /*
        indeed, COMP is claimable by anyone, so it would make sense to extend this
        model to other rewards tokens, but we always err on the side of
        the "principle of least privelege" so that flaws in such mechanics are siloed.
        **/
        if (msg.sender != _controller && msg.sender != _factory) _require(msg.sender == _manager, uint256(0xb3e5dea2190e04) /* error_macro_for("claimAll: caller must be controller or manager.") */);
        StrategyClaim.claimAll(_claimables);
    }

    /**
     * @notice Settle the amount held for each Synth after an exchange has occured and the oracles have resolved a price
     */
    function settleSynths() public override {
        if (supportsSynths()) {
            IExchanger exchanger = IExchanger(synthetixResolver.getAddress("Exchanger"));
            IIssuer issuer = IIssuer(synthetixResolver.getAddress("Issuer"));
            exchanger.settle(address(this), "sUSD");
            uint256 length = _synths.length;
            for (uint256 i; i < length; ++i) {
                exchanger.settle(address(this), issuer.synthsByAddress(ISynth(_synths[i]).target()));
            }
        }
    }

    function updateRebalanceThreshold(uint16 threshold) external override {
        _onlyController();
        _rebalanceThreshold = threshold;
    }

    /**
        @notice Update the manager of this Strategy
     */
    function updateManager(address newManager) external override {
        _onlyManager();
        address manager = _manager;
        address pool = _pool;
        _issueStreamingFee(pool, manager);
        _require(newManager != manager, uint256(0xb3e5dea2190e05) /* error_macro_for("Manager already set") */);
        // Reset paid token values
        _paidTokenValues[manager] = _lastTokenValue;
        _paidTokenValues[newManager] = uint256(-1);
        _manager = newManager;
        _updateStreamingFeeRate(pool, newManager);
        emit UpdateManager(newManager);
    }

    /**
        @notice Update an item's trade data
     */
    function updateTradeData(address item, TradeData calldata data) external override {
        _onlyManager();
        _startTimelock(
          keccak256(abi.encode(this.updateTradeData.selector)), // identifier
          abi.encode(item, data)); // payload
        emit UpdateTradeData(item, false);
    }

    function finalizeUpdateTradeData() external {
        bytes32 key = keccak256(abi.encode(this.updateTradeData.selector));
        _require(_timelockIsReady(key), uint256(0xb3e5dea2190e06) /* error_macro_for("finalizeUpdateTradeData: timelock not ready.") */);
        (address item, TradeData memory data) = abi.decode(_getTimelockValue(key), (address, TradeData));
        _tradeData[item] = data;
        _resetTimelock(key);
        emit UpdateTradeData(item, true);
    }

    /**
     * @dev Updates implementation version
     */
    function updateVersion(string calldata newVersion) external override {
        _require(msg.sender == _factory, uint256(0xb3e5dea2190e07) /* error_macro_for("Only StrategyProxyFactory") */);
        _version = newVersion;
        _setDomainSeperator();
        updateAddresses();
    }

    function lock() external override {
        _onlyController();
        _setLock();
    }

    function unlock() external override {
        _onlyController();
        _removeLock();
    }

    function locked() external view override returns (bool) {
        return _locked == 1;
    }

    function items() external view override returns (address[] memory) {
        return _items;
    }

    function synths() external view override returns (address[] memory) {
        return _synths;
    }

    function debt() external view override returns (address[] memory) {
        return _debt;
    }

    function rebalanceThreshold() external view override returns (uint256) {
        return uint256(_rebalanceThreshold);
    }

    function getPercentage(address item) external view override returns (int256) {
        return _percentage[item];
    }

    function getTradeData(address item) external view override returns (TradeData memory) {
        return _tradeData[item];
    }

    function manager() external view override(IStrategy, IStrategyManagement) returns (address) {
        return _manager;
    }

    function supportsSynths() public view override returns (bool) {
        return _synths.length != 0;
    }

    function supportsDebt() external view override returns (bool) {
        return _debt.length != 0;
    }

    function _deletePercentages(address[] storage assets) private {
        address[] memory _assets = assets;
        uint256 length = _assets.length;
        for (uint256 i; i < length; ++i) {
            delete _percentage[_assets[i]];
        }
    }

    /**
     * @notice Set the structure of the strategy
     * @param newItems An array of Item structs that will comprise the strategy
     */
    function _setStructure(StrategyItem[] memory newItems) private {
        address weth = _weth;
        address susd = _susd;
        // Remove old percentages
        delete _percentage[weth];
        delete _percentage[susd];
        delete _percentage[address(-1)];
        _deletePercentages(_items);
        _deletePercentages(_debt);
        _deletePercentages(_synths);
        delete _items;
        delete _debt;
        delete _synths;

        ITokenRegistry tokenRegistry = ITokenRegistry(IStrategyProxyFactory(_factory).tokenRegistry());
        // Set new items
        int256 virtualPercentage;
        BinaryTree.Tree memory exists = BinaryTree.newNode();
        uint256 length = newItems.length;
        for (uint256 i; i < length; ++i) {
            virtualPercentage = virtualPercentage.add(_setItem(newItems[i], tokenRegistry));
            exists.add(bytes32(uint256(newItems[i].item)));
        }
        if (_synths.length != 0) {
            // Add SUSD percentage
            virtualPercentage = virtualPercentage.add(_percentage[susd]);
            _percentage[address(-1)] = virtualPercentage;
        } else if (_percentage[susd] > 0) {
            //If only synth is SUSD, treat it like a regular token
            _items.push(susd);
        }
        _updateRewards(exists, tokenRegistry);
    }

    function _setItem(StrategyItem memory strategyItem, ITokenRegistry tokenRegistry) private returns(int256) {
        address newItem = strategyItem.item;
        _tradeData[newItem] = strategyItem.data;
        _percentage[newItem] = strategyItem.percentage;
        ItemCategory category = ItemCategory(tokenRegistry.itemCategories(newItem));
        int256 virtualPercentage;
        address[] storage _assets;
        if (category == ItemCategory.BASIC) {
            _assets = _items;
        } else if (category == ItemCategory.SYNTH) {
            virtualPercentage = strategyItem.percentage;
            _assets = _synths;
        } else if (category == ItemCategory.DEBT) {
            _assets = _debt;
        }
        if (category < ItemCategory.RESERVE) { // ensures the following `_assets` has been assigned so the "push" makes sense
            _assets = _assets; // compiler hack
            _assets.push(newItem);
        }
        return virtualPercentage;
    }

    function _updateRewards(BinaryTree.Tree memory exists, ITokenRegistry tokenRegistry) private {
        _updateClaimables(tokenRegistry);
        address[] memory rewardTokens = StrategyClaim.getAllRewardTokens(tokenRegistry);
        StrategyItem memory item;
        uint256 length = rewardTokens.length;
        for (uint256 i; i < length; ++i) {
            if (_tokenExists(exists, rewardTokens[i])) continue;
            exists.add(bytes32(uint256(rewardTokens[i])));
            item = StrategyItem({item: rewardTokens[i], percentage: 0, data: tokenRegistry.itemDetails(rewardTokens[i]).tradeData});
            _setItem(item, tokenRegistry);
        }
    }

    function _updateClaimables(ITokenRegistry tokenRegistry) internal {
        delete _claimables;
        (, bytes[] memory values) = StrategyClaim.getAllToClaim(tokenRegistry);
        uint256 length = values.length;
        for (uint256 i; i < length; ++i) {
            _claimables.push(values[i]); // grouped by rewardsAdapter
        }
        emit ClaimablesUpdated();
    }

    function updateClaimables() external {
        ITokenRegistry tokenRegistry = ITokenRegistry(IStrategyProxyFactory(_factory).tokenRegistry());
        _updateClaimables(tokenRegistry);
    }

    function updateAddresses() public {
        IStrategyProxyFactory f = IStrategyProxyFactory(_factory);
        address newPool = f.pool();
        address currentPool = _pool;
        if (newPool != currentPool) {
            // If pool has been initialized but is now changing update paidTokenValue
            if (currentPool != address(0)) {
                address manager = _manager;
                _issueStreamingFee(currentPool, manager);
                _updateStreamingFeeRate(newPool, manager);
                _paidTokenValues[currentPool] = _lastTokenValue;
            }
            _paidTokenValues[newPool] = uint256(-1);
            _pool = newPool;
        }
        IOracle ensoOracle = IOracle(f.oracle());
        _weth = ensoOracle.weth();
        _susd = ensoOracle.susd();
    }

    function updateRewards() external {
        ITokenRegistry tokenRegistry = ITokenRegistry(IStrategyProxyFactory(_factory).tokenRegistry());
        BinaryTree.Tree memory exists = BinaryTree.newNode();
        _setTokensExists(exists, _items);
        _setTokensExists(exists, _debt);
        _setTokensExists(exists, _synths);
        _updateRewards(exists, tokenRegistry);
        emit RewardsUpdated();
    }

    function _setTokensExists(BinaryTree.Tree memory exists, address[] memory tokens) private pure {
        uint256 length = tokens.length;
        for (uint256 i; i < length; ++i) {
            if (_tokenExists(exists, tokens[i])) continue;
            exists.add(bytes32(uint256(tokens[i])));
        }
    }

    function _tokenExists(BinaryTree.Tree memory exists, address token) private pure returns (bool ok){
        return exists.doesExist(bytes32(uint256(token)));
    }

    function _timelockData(bytes32 identifier) internal override returns(TimelockData storage) {
        return __timelockData[identifier];
    }
}
