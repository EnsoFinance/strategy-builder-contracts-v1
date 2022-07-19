//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "./libraries/SafeERC20.sol";
import "./libraries/StrategyClaim.sol";
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
    using MemoryMappings for BinaryTreeWithPayload.Tree;

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
        string memory name_,
        string memory symbol_,
        string memory version_,
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
        if (strategyItems_.length > 0) {
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
        address[] memory tokens,
        address account,
        uint256 amount
    ) external override {
        _onlyController();
        for (uint256 i; i < tokens.length; ++i) {
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
        address[] memory tokens,
        address account,
        uint256 amount
    ) external override {
        _onlyController();
        for (uint256 i; i < tokens.length; ++i) {
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
        StrategyClaim._claimAll(_claimables);
        _setStructure(newItems);
    }

    function setRouter(address router) external override {
        _onlyController();
        _tempRouter = router;
    }

    function updateTimelock(bytes4 functionSelector, uint256 delay) external override {
        _onlyManager();
        _startTimelock(this.updateTimelock.selector, abi.encode(functionSelector, delay));
        emit UpdateTimelock(delay, false);
    }

    function finalizeTimelock() external override {
        if (!_timelockIsReady(this.updateTimelock.selector)) {
            TimelockData memory td = _timelockData(this.updateTimelock.selector);
            _require(td.delay == 0, uint256(0xb3e5dea2190e00) /* error_macro_for("finalizeTimelock: timelock is not ready.") */);
        }
        (bytes4 selector, uint256 delay) = abi.decode(_getTimelockValue(this.updateTimelock.selector), (bytes4, uint256));
        _setTimelock(selector, delay);
        _resetTimelock(this.updateTimelock.selector);
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
        _require(amount > 0, uint256(0xb3e5dea2190e03) /* error_macro_for("0 amount") */);
        settleSynths();
        uint256 percentage;
        {
            // Deduct withdrawal fee, burn tokens, and calculate percentage
            uint256 totalSupplyBefore = _totalSupply; // Need to get total supply before burn to properly calculate percentage
            _issueStreamingFeeAndBurn(_pool, _manager, msg.sender, amount);
            percentage = amount.mul(PRECISION).div(totalSupplyBefore);
        }
        // Withdraw funds
        uint256 itemsLength = _items.length;
        uint256 synthsLength = _synths.length;
        bool isSynths = synthsLength > 0;
        uint256 numTokens = isSynths ? itemsLength + synthsLength + 2 : itemsLength + 1;
        IERC20[] memory tokens = new IERC20[](numTokens);
        uint256[] memory amounts = new uint256[](numTokens);
        for (uint256 i; i < itemsLength; ++i) {
           // Should not be possible to have address(0) since the Strategy will check for it
           IERC20 token = IERC20(_items[i]);
           uint256 currentBalance = token.balanceOf(address(this));
           amounts[i] = currentBalance.mul(percentage) / PRECISION;
           tokens[i] = token;
        }
        if (isSynths) {
            for (uint256 i = itemsLength; i < numTokens - 2; ++i) {
                IERC20 synth = IERC20(_synths[i - itemsLength]);
                uint256 currentBalance = synth.balanceOf(address(this));
                amounts[i] = currentBalance.mul(percentage) / PRECISION;
                tokens[i] = synth;
            }
            // Include SUSD
            IERC20 susd = IERC20(_susd);
            uint256 susdBalance = susd.balanceOf(address(this));
            amounts[numTokens - 2] = susdBalance.mul(percentage) / PRECISION;
            tokens[numTokens - 2] = susd;
        }
        // Include WETH
        IERC20 weth = IERC20(_weth);
        uint256 wethBalance = weth.balanceOf(address(this));
        amounts[numTokens - 1] = wethBalance.mul(percentage) / PRECISION;
        tokens[numTokens - 1] = weth;
        // Transfer amounts
        for (uint256 i; i < numTokens; ++i) {
            if (amounts[i] > 0) tokens[i].safeTransfer(msg.sender, amounts[i]);
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
        // Note: No reentrancy lock since only callable by repositionSynths function in controller which already locks
        _require(whitelist().approved(adapter), uint256(0xb3e5dea2190e04) /* error_macro_for("Not approved") */);
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

    function getAllRewardTokens() external view returns(address[] memory rewardTokens) {
        ITokenRegistry tokenRegistry = ITokenRegistry(IStrategyProxyFactory(_factory).tokenRegistry());
        return StrategyClaim._getAllRewardTokens(tokenRegistry);
    }

    // claim all rewards tokens of claimables
    function claimAll() external override {
        /*
        indeed, COMP is claimable by anyone, so it would make sense to extend this
        model to other rewards tokens, but we always err on the side of
        the "principle of least privelege" so that flaws in such mechanics are siloed.
        **/
        if (msg.sender != _controller && msg.sender != _factory) _require(msg.sender == _manager, uint256(0xb3e5dea2190e05) /* error_macro_for("claimAll: caller must be controller or manager.") */);
        StrategyClaim._claimAll(_claimables);
    }

    /**
     * @notice Settle the amount held for each Synth after an exchange has occured and the oracles have resolved a price
     */
    function settleSynths() public override {
        if (supportsSynths()) {
            IExchanger exchanger = IExchanger(synthetixResolver.getAddress("Exchanger"));
            IIssuer issuer = IIssuer(synthetixResolver.getAddress("Issuer"));
            exchanger.settle(address(this), "sUSD");
            for (uint256 i; i < _synths.length; ++i) {
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
        _require(newManager != manager, uint256(0xb3e5dea2190e06) /* error_macro_for("Manager already set") */);
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
    function updateTradeData(address item, TradeData memory data) external override {
        _onlyManager();
        _startTimelock(this.updateTradeData.selector, abi.encode(item, data));
        emit UpdateTradeData(item, false);
    }

    function finalizeUpdateTradeData() external {
        _require(_timelockIsReady(this.updateTradeData.selector), uint256(0xb3e5dea2190e07) /* error_macro_for("finalizeUpdateTradeData: timelock not ready.") */);
        (address item, TradeData memory data) = abi.decode(_getTimelockValue(this.updateTradeData.selector), (address, TradeData));
        _tradeData[item] = data;
        _resetTimelock(this.updateTradeData.selector);
        emit UpdateTradeData(item, true);
    }

    /**
     * @dev Updates implementation version
     */
    function updateVersion(string memory newVersion) external override {
        _require(msg.sender == _factory, uint256(0xb3e5dea2190e08) /* error_macro_for("Only StrategyProxyFactory") */);
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
        return _locked % 2 == 1;
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

    function controller() public view override returns (address) {
        return _controller;
    }

    function factory() public view returns (address) {
        return _factory;
    }

    function whitelist() public view override returns (IWhitelist) {
        return IWhitelist(IStrategyProxyFactory(_factory).whitelist());
    }

    function supportsSynths() public view override returns (bool) {
        return _synths.length > 0;
    }

    function supportsDebt() public view override returns (bool) {
        return _debt.length > 0;
    }

    function _deletePercentages(address[] storage assets) private {
        address[] memory _assets = assets;
        uint256 assetsLength = _assets.length;
        for (uint256 i; i < assetsLength; ++i) {
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
        BinaryTreeWithPayload.Tree memory exists = BinaryTreeWithPayload.newNode();
        for (uint256 i; i < newItems.length; ++i) {
            virtualPercentage = virtualPercentage.add(_setItem(newItems[i], tokenRegistry));
            exists.add(bytes32(uint256(newItems[i].item)), bytes32(0x0)); // second parameter is "any" value
        }

        if (_percentage[susd] > 0) {
            //If only synth is SUSD, treat it like a regular token
            _items.push(susd);
            exists.add(bytes32(uint256(susd)), bytes32(0x0)); // second parameter is "any" value
        }
        _updateRewards(exists, tokenRegistry);
        if (_synths.length > 0) {
            // Add SUSD percentage
            virtualPercentage = virtualPercentage.add(_percentage[susd]);
            _percentage[address(-1)] = virtualPercentage;
        }
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

    function _updateRewards(BinaryTreeWithPayload.Tree memory exists, ITokenRegistry tokenRegistry) private {
        _updateClaimables(tokenRegistry);
        address[] memory rewardTokens = StrategyClaim._getAllRewardTokens(tokenRegistry);
        bool ok;
        StrategyItem memory item;
        for (uint256 i; i < rewardTokens.length; ++i) {
            (ok, ) = exists.getValue(bytes32(uint256(rewardTokens[i])));
            if (ok) continue;
            exists.add(bytes32(uint256(rewardTokens[i])), bytes32(0x0)); // second parameter is "any" value
            item = StrategyItem({item: rewardTokens[i], percentage: 0, data: tokenRegistry.itemDetails(rewardTokens[i]).tradeData});
            _setItem(item, tokenRegistry);
        }
    }

    function _updateClaimables(ITokenRegistry tokenRegistry) internal {
        delete _claimables;
        (, bytes[] memory values) = StrategyClaim._getAllToClaim(tokenRegistry);
        for (uint256 i; i < values.length; ++i) {
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
        BinaryTreeWithPayload.Tree memory exists = BinaryTreeWithPayload.newNode();
        _setTokensExists(exists, _items);
        _setTokensExists(exists, _debt);
        _setTokensExists(exists, _synths);
        _updateRewards(exists, tokenRegistry);
        emit RewardsUpdated();
    }

    function _setTokensExists(BinaryTreeWithPayload.Tree memory exists, address[] memory tokens) private pure {
        bool ok;
        for (uint256 i; i < tokens.length; ++i) {
            (ok, ) = exists.getValue(bytes32(uint256(tokens[i])));
            if (ok) continue;
            exists.add(bytes32(uint256(tokens[i])), bytes32(0x0)); // second parameter is "any" value
        }
    }

    function _timelockData(bytes4 functionSelector) internal override returns(TimelockData storage) {
        return __timelockData[functionSelector];
    }
}
