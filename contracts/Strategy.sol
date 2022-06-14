//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "./libraries/SafeERC20.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IStrategyManagement.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/IStrategyProxyFactory.sol";
import "./interfaces/IRewardsAdapter.sol";
import "./interfaces/synthetix/IDelegateApprovals.sol";
import "./interfaces/synthetix/IExchanger.sol";
import "./interfaces/synthetix/IIssuer.sol";
import "./interfaces/aave/ILendingPool.sol";
import "./interfaces/aave/IDebtToken.sol";
import "./helpers/Timelocks.sol";
import "./helpers/Require.sol";
import "./StrategyToken.sol";

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
contract Strategy is IStrategy, IStrategyManagement, StrategyToken, Initializable, Timelocks, Require {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;

    uint256 private constant YEAR = 365 days;
    uint256 private constant POOL_SHARE = 300;
    uint256 private constant DIVISOR = 1000;
    // Withdrawal fee: 0.2% of amount withdrawn goes to the fee pool
    uint256 public constant WITHDRAWAL_FEE = 2*10**15;
    // Streaming fee: The streaming fee streams 0.1% of the strategy's value over
    // a year via inflation. The multiplier (0.001001001) is used to calculate
    // the amount of tokens that need to be minted over a year to give the fee
    // pool 0.1% of the tokens (STREAM_FEE*totalSupply)
    uint256 public constant STREAM_FEE = uint256(1001001001001001);

    ISynthetixAddressResolver private immutable synthetixResolver;
    IAaveAddressResolver private immutable aaveResolver;
    address public immutable factory;
    address public immutable override controller;

    event Withdraw(address indexed account, uint256 amount, uint256[] amounts);
    event RewardsClaimed(address indexed adapter, address[] tokens);
    event UpdateManager(address manager);
    event UpdateTradeData(address item, bool finalized);

    // Initialize constructor to disable implementation
    constructor(address factory_, address controller_, address synthetixResolver_, address aaveResolver_) public initializer {
        factory = factory_;
        controller = controller_;
        synthetixResolver = ISynthetixAddressResolver(synthetixResolver_);
        aaveResolver = IAaveAddressResolver(aaveResolver_);
    }

    /**
     * @dev Throws if called by any account other than the controller.
     */
    modifier onlyController() {
        _require(controller == msg.sender, uint256(0xb3e5dea2190e00) /* error_macro_for("Controller only") */);
        _;
    }

    /**
     * @dev Throws if called by any account other than the temporary router.
     */
    modifier onlyRouter() {
        _require(_tempRouter == msg.sender, uint256(0xb3e5dea2190e01) /* error_macro_for("Router only") */);
        _;
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
        _lastTokenValue = uint128(10**18);
        _lastStreamTimestamp = uint96(block.timestamp);
        _setDomainSeperator();
        updateAddresses();
        // Set structure
        if (strategyItems_.length > 0) {
            IStrategyController(controller).verifyStructure(address(this), strategyItems_);
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
    ) external override onlyController {
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
    ) external override onlyController {
        for (uint256 i = 0; i < tokens.length; i++) {
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
    ) external override onlyController {
        for (uint256 i = 0; i < tokens.length; i++) {
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
    ) external override onlyController {
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
        onlyController
    {
        _setStructure(newItems);
    }

    function setRouter(address router) external override onlyController {
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
            _require(td.delay == 0, uint256(0xb3e5dea2190e02) /* error_macro_for("finalizeTimelock: timelock is not ready.") */);
        }
        (bytes4 selector, uint256 delay) = abi.decode(_getTimelockValue(this.updateTimelock.selector), (bytes4, uint256));
        _setTimelock(selector, delay);
        _resetTimelock(this.updateTimelock.selector);
        emit UpdateTimelock(delay, true);
    }

    function setCollateral(address token) external override onlyRouter {
        ILendingPool(aaveResolver.getLendingPool()).setUserUseReserveAsCollateral(token, true);
    }

    // claim all rewards tokens of claimables
    function claimAll() external override {
        _claimAll();
    }

    function _claimAll() private {
        /* 
        indeed, COMP is claimable by anyone, so it would make sense to extend this
        model to other rewards tokens, but we always err on the side of 
        the "principle of least privelege" so that flaws in such mechanics are siloed.
        **/
        if (msg.sender != controller && msg.sender != factory) _require(msg.sender == _manager, uint256(0xb3e5dea2190e03) /* error_macro_for("claimAll: caller must be controller or manager.") */);
        address rewardsAdapter;
        Claimable memory claimableData;
        address[] memory strategyClaimables = _claimables;
        for (uint256 i; i < strategyClaimables.length; ++i) {
            rewardsAdapter = strategyClaimables[i];
            claimableData = _claimableData[rewardsAdapter];
            _delegateClaim(rewardsAdapter, claimableData.tokens);
        }
    }

    /**
     * @notice Withdraw the underlying assets and burn the equivalent amount of strategy token
     * @param amount The amount of strategy tokens to burn to recover the equivalent underlying assets
     */
    function withdrawAll(uint256 amount) external override {
        _setLock();
        _require(_debt.length == 0, uint256(0xb3e5dea2190e04) /* error_macro_for("Cannot withdraw debt") */);
        _require(amount > 0, uint256(0xb3e5dea2190e05) /* error_macro_for("0 amount") */);
        settleSynths();
        uint256 percentage;
        {
            // Deduct withdrawal fee, burn tokens, and calculate percentage
            uint256 totalSupplyBefore = _totalSupply; // Need to get total supply before burn to properly calculate percentage
            amount = _deductFeeAndBurn(msg.sender, amount);
            percentage = amount.mul(10**18).div(totalSupplyBefore);
        }
        // Withdraw funds
        uint256 itemsLength = _items.length;
        uint256 synthsLength = _synths.length;
        bool isSynths = synthsLength > 0;
        uint256 numTokens = isSynths ? itemsLength + synthsLength + 2 : itemsLength + 1;
        IERC20[] memory tokens = new IERC20[](numTokens);
        uint256[] memory amounts = new uint256[](numTokens);
        for (uint256 i = 0; i < itemsLength; i++) {
            // Should not be possible to have address(0) since the Strategy will check for it
            IERC20 token = IERC20(_items[i]);
            uint256 currentBalance = token.balanceOf(address(this));
            amounts[i] = currentBalance.mul(percentage).div(10**18);
            tokens[i] = token;
        }
        if (isSynths) {
            for (uint256 i = itemsLength; i < numTokens - 2; i ++) {
                IERC20 synth = IERC20(_synths[i - itemsLength]);
                uint256 currentBalance = synth.balanceOf(address(this));
                amounts[i] = currentBalance.mul(percentage).div(10**18);
                tokens[i] = synth;
            }
            // Include SUSD
            IERC20 susd = IERC20(_susd);
            uint256 susdBalance = susd.balanceOf(address(this));
            amounts[numTokens - 2] = susdBalance.mul(percentage).div(10**18);
            tokens[numTokens - 2] = susd;
        }
        // Include WETH
        IERC20 weth = IERC20(_weth);
        uint256 wethBalance = weth.balanceOf(address(this));
        amounts[numTokens - 1] = wethBalance.mul(percentage).div(10**18);
        tokens[numTokens - 1] = weth;
        // Transfer amounts
        for (uint256 i = 0; i < numTokens; i++) {
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
    function mint(address account, uint256 amount) external override onlyController {
        //Assumes updateTokenValue has been called
        address pool = _pool;
        _mint(account, amount);
    }

    /**
     * @notice Burn tokens. Only callable by controller
     * @param account The address of the account getting tokens removed
     * @param amount The amount of tokens being burned
     */
    function burn(address account, uint256 amount) external override onlyController returns (uint256){
        return _deductFeeAndBurn(account, amount);
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
    ) external override onlyController {
        // Note: No reentrancy lock since only callable by repositionSynths function in controller which already locks
        _onlyApproved(adapter);
        bytes memory swapData =
            abi.encodeWithSelector(
                bytes4(
                    keccak256("swap(uint256,uint256,address,address,address,address)")
                ),
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

    /**
     * @notice Settle the amount held for each Synth after an exchange has occured and the oracles have resolved a price
     */
    function settleSynths() public override {
        if (supportsSynths()) {
            IExchanger exchanger = IExchanger(synthetixResolver.getAddress("Exchanger"));
            IIssuer issuer = IIssuer(synthetixResolver.getAddress("Issuer"));
            exchanger.settle(address(this), "sUSD");
            for (uint256 i = 0; i < _synths.length; i++) {
                exchanger.settle(address(this), issuer.synthsByAddress(ISynth(_synths[i]).target()));
            }
        }
    }

    /**
     * @notice Update the per token value based on the most recent strategy value.
     */
    function updateTokenValue() external {
        _setLock();
        _onlyManager();
        _updateTokenValue();
        _removeLock();
    }

    /**
     * @notice Update the per token value based on the most recent strategy value. Only callable by controller
     * @param total The current total value of the strategy in WETH
     * @param supply The new supply of the token (updateTokenValue needs to be called before mint, so the new supply has to be passed in)
     */
    function updateTokenValue(uint256 total, uint256 supply) external override onlyController {
        _setTokenValue(total, supply);
    }

    function updateRebalanceThreshold(uint16 threshold) external override onlyController {
        _rebalanceThreshold = threshold;
    }

    /**
        @notice Update the manager of this Strategy
     */
    function updateManager(address newManager) external override {
        _onlyManager();
        _require(newManager != _manager, uint256(0xb3e5dea2190e08) /* error_macro_for("Manager already set") */);
        // Reset paid token values
        _paidTokenValues[_manager] = _lastTokenValue;
        _paidTokenValues[newManager] = uint256(-1);
        _manager = newManager;
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
        _require(_timelockIsReady(this.updateTradeData.selector), uint256(0xb3e5dea2190e09) /* error_macro_for("finalizeUpdateTradeData: timelock not ready.") */);
        (address item, TradeData memory data) = abi.decode(_getTimelockValue(this.updateTradeData.selector), (address, TradeData));
        _tradeData[item] = data;
        _resetTimelock(this.updateTradeData.selector);
        emit UpdateTradeData(item, true);
    }

    /**
        @notice Refresh Strategy's addresses
     */
    function updateAddresses() public {
        IStrategyProxyFactory f = IStrategyProxyFactory(factory);
        address newPool = f.pool();
        address currentPool = _pool;
        if (newPool != currentPool) {
            // If pool has been initialized but is now changing update paidTokenValue
            if (currentPool != address(0)) {
                _paidTokenValues[currentPool] = _lastTokenValue;
            }
            _paidTokenValues[newPool] = uint256(-1);
            _pool = newPool;
        }
        address o = f.oracle();
        if (o != _oracle) {
            IOracle ensoOracle = IOracle(o);
            _oracle = o;
            _weth = ensoOracle.weth();
            _susd = ensoOracle.susd();
        }
    }

    /**
     * @dev Updates implementation version
     */
    function updateVersion(string memory newVersion) external override {
        _require(msg.sender == factory, uint256(0xb3e5dea2190e0a) /* error_macro_for("Only StrategyProxyFactory") */);
        _version = newVersion;
        _setDomainSeperator();
        updateAddresses();
    }

    function lock() external override onlyController {
        _setLock();
    }

    function unlock() external override onlyController {
        _removeLock();
    }

    function locked() external view override returns (bool) {
        return _locked != 0;
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

    function claimables() external view override returns (address[] memory) {
        return _claimables;
    }

    function claimableData(address claimable) external view override returns (Claimable memory) {
        return _claimableData[claimable];
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

    function getPaidTokenValue(address account) external view returns (uint256) {
        return uint256(_paidTokenValues[account]);
    }

    function getLastTokenValue() external view returns (uint256) {
        return uint256(_lastTokenValue);
    }

    function manager() external view override(IStrategy, IStrategyManagement) returns (address) {
        return _manager;
    }

    function oracle() public view override returns (IOracle) {
        return IOracle(_oracle);
    }

    function whitelist() public view override returns (IWhitelist) {
        return IWhitelist(IStrategyProxyFactory(factory).whitelist());
    }

    function supportsSynths() public view override returns (bool) {
        return _synths.length > 0;
    }

    function supportsDebt() public view override returns (bool) {
        return _debt.length > 0;
    }

    /**
     * @notice Claim rewards using a delegate call to an adapter
     * @param adapter The address of the adapter that this function does a delegate call to.
                      It must support the IRewardsAdapter interface and be whitelisted
     * @param tokens The addresses of the tokens being claimed
     */
    function _delegateClaim(address adapter, address[] memory tokens) internal {
        _onlyApproved(adapter);
        bytes memory data =
            abi.encodeWithSelector(
                bytes4(keccak256("claim(address[])")),
                tokens
            );
        uint256 txGas = gasleft();
        bool success;
        assembly {
            success := delegatecall(txGas, adapter, add(data, 0x20), mload(data), 0, 0)
        }
        if (!success) {
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
        emit RewardsClaimed(adapter, tokens);
    }

    /**
     * @notice Set the structure of the strategy
     * @param newItems An array of Item structs that will comprise the strategy
     */
    function _setStructure(StrategyItem[] memory newItems) internal {
        address weth = _weth;
        address susd = _susd;
        // Remove old claimables
        _claimAll();
        _removeClaimables();
        // Remove old percentages
        delete _percentage[weth];
        delete _percentage[susd];
        delete _percentage[address(-1)];
        for (uint256 i = 0; i < _items.length; i++) {
            delete _percentage[_items[i]];
        }
        for (uint256 i = 0; i < _debt.length; i++) {
            delete _percentage[_debt[i]];
        }
        for (uint256 i = 0; i < _synths.length; i++) {
            delete _percentage[_synths[i]];
        }
        delete _debt;
        delete _items;
        delete _synths;

        if (oracle() != IStrategyController(controller).oracle()) updateAddresses();
        ITokenRegistry tokenRegistry = oracle().tokenRegistry();
        // Set new items
        int256 virtualPercentage = 0;
        for (uint256 i = 0; i < newItems.length; i++) {
            address newItem = newItems[i].item;
            _tradeData[newItem] = newItems[i].data;
            _percentage[newItem] = newItems[i].percentage;
            ItemCategory category = ItemCategory(tokenRegistry.itemCategories(newItem));
            if (category == ItemCategory.BASIC) {
                _items.push(newItem);
            } else if (category == ItemCategory.SYNTH) {
                virtualPercentage = virtualPercentage.add(_percentage[newItem]);
                _synths.push(newItem);
            } else if (category == ItemCategory.DEBT) {
                _debt.push(newItem);
            } else if (category == ItemCategory.CLAIMABLE) {
                _items.push(newItem);
                _setClaimable(newItems[i]);
            }
        }
        if (_synths.length > 0) {
            // Add SUSD percentage
            virtualPercentage = virtualPercentage.add(_percentage[susd]);
            _percentage[address(-1)] = virtualPercentage;
        } else if (_percentage[susd] > 0) {
            //If only synth is SUSD, treat it like a regular token
            _items.push(susd);
        }
    }

    function _setClaimable(StrategyItem memory claimableItem) internal {
        bytes4 _claimableDataSig = bytes4(0x540f3bc9); // keccak256(abi.encodePacked("_claimableData"))
        if (_exists[keccak256(abi.encode(_claimableDataSig, claimableItem.item))]) return;
        _exists[keccak256(abi.encode(_claimableDataSig, claimableItem.item))] = true;

        uint256 len = claimableItem.data.adapters.length;
        _require(len > 0, uint256(0xb3e5dea2190e0b) /* error_macro_for("_setClaimable: adapters.length == 0.") */);

        address rewardsAdapter = claimableItem.data.adapters[len-1];
        Claimable storage claimable = _claimableData[rewardsAdapter];
        if (claimable.tokens.length == 0) { // it hasn't been stored
            _claimables.push(rewardsAdapter);
        }
        claimable.tokens.push(claimableItem.item);
        address[] memory rewardsTokens = IRewardsAdapter(rewardsAdapter).rewardsTokens(claimableItem.item);
        len = rewardsTokens.length;
        for (uint256 i; i < len; ++i) {
            if (_exists[keccak256(abi.encode(_claimableDataSig, rewardsTokens[i]))]) continue;
            _exists[keccak256(abi.encode(_claimableDataSig, rewardsTokens[i]))] = true;
            claimable.rewardsTokens.push(rewardsTokens[i]);
        }
    }

    function _removeClaimables() internal {
        address[] memory claimables = _claimables;
        Claimable memory claimableData;
        address[] memory tokens;
        bytes4 _claimableDataSig = bytes4(0x540f3bc9); // keccak256(abi.encodePacked("_claimableData"))
        for (uint256 i; i < claimables.length; ++i) {
            claimableData = _claimableData[claimables[i]];
            tokens = claimableData.tokens;
            for (uint256 j; j < tokens.length; ++j) {
                _exists[keccak256(abi.encode(_claimableDataSig, tokens[j]))] = false;
            }
            tokens = claimableData.rewardsTokens;
            for (uint256 j; j < tokens.length; ++j) {
                _exists[keccak256(abi.encode(_claimableDataSig, tokens[j]))] = false;
            }
            delete _claimableData[claimables[i]];
        }
        delete _claimables;
    }

    /**
     * @notice Sets the new _lastTokenValue based on the total price and token supply
     */
    function _setTokenValue(uint256 total, uint256 supply) internal {
        if (supply > 0) _lastTokenValue = uint128(total.mul(10**18).div(supply));
    }

    /**
     * @notice Update the per token value based on the most recent strategy value.
     */
    function _updateTokenValue() internal {
        if (oracle() != IStrategyController(controller).oracle()) updateAddresses();
        (uint256 total, ) = oracle().estimateStrategy(this);
        _setTokenValue(total, _totalSupply);
    }

    /**
     * @notice Deduct withdrawal fee and burn remaining tokens. Returns the amount of tokens that have been burned
     */
    function _deductFeeAndBurn(address account, uint256 amount) internal returns (uint256) {
        //address pool = _pool;
        //amount = _deductWithdrawalFee(account, pool, amount);
        _burn(account, amount);
        //_updateStreamingFeeRate(pool);
        return amount;
    }

    /**
     * @notice Averages the paid token value of a user between two sets of tokens that have paid different fees
     */
    function _avgPaidTokenValue(
      uint256 amountA,
      uint256 amountB,
      uint256 paidValueA,
      uint256 paidValueB
    ) internal pure returns (uint256) {
        return amountA.mul(paidValueA).add(amountB.mul(paidValueB)).div(amountA.add(amountB));
    }

    /**
     * @notice Checks that router is whitelisted
     */
    function _onlyApproved(address account) internal view {
        _require(whitelist().approved(account), uint256(0xb3e5dea2190e0c) /* error_macro_for("Not approved") */);
    }

    function _onlyManager() internal view {
        _require(msg.sender == _manager, uint256(0xb3e5dea2190e0d) /* error_macro_for("Not manager") */);
    }

    /**
     * @notice Sets Reentrancy guard
     */
    function _setLock() internal {
        _require(_locked == 0, uint256(0xb3e5dea2190e0e) /* error_macro_for("No Reentrancy") */);
        _locked = 1;
    }

    /**
     * @notice Removes reentrancy guard.
     */
    function _removeLock() internal {
        _locked = 0;
    }

    function _timelockData(bytes4 functionSelector) internal override returns(TimelockData storage) {
        return __timelockData[functionSelector];
    }
}
