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
import "./interfaces/synthetix/IDelegateApprovals.sol";
import "./interfaces/synthetix/IExchanger.sol";
import "./interfaces/synthetix/IIssuer.sol";
import "./interfaces/aave/ILendingPool.sol";
import "./interfaces/aave/IDebtToken.sol";
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
contract Strategy is IStrategy, IStrategyManagement, StrategyToken, Initializable {
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
    event RewardsClaimed(address indexed adapter, address indexed token);
    event UpdateManager(address manager);
    event PerformanceFee(address indexed account, uint256 amount);
    event WithdrawalFee(address indexed account, uint256 amount);
    event StreamingFee(uint256 amount);

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
        require(controller == msg.sender, "Controller only");
        _;
    }

    /**
     * @dev Throws if called by any account other than the temporary router.
     */
    modifier onlyRouter() {
        require(_tempRouter == msg.sender, "Router only");
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

    function setCollateral(address token) external override onlyRouter {
        ILendingPool(aaveResolver.getLendingPool()).setUserUseReserveAsCollateral(token, true);
    }

    /**
     * @notice Withdraw the underlying assets and burn the equivalent amount of strategy token
     * @param amount The amount of strategy tokens to burn to recover the equivalent underlying assets
     */
    function withdrawAll(uint256 amount) external override {
        _setLock();
        require(_debt.length == 0, "Cannot withdraw debt");
        require(amount > 0, "0 amount");
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
     * @notice Withdraws the performance fee to the manager and the fee pool
     * @param holders An array of accounts that will be used to calculate the performance fee
     */
    function withdrawPerformanceFee(address[] memory holders) external {
        _setLock();
        _onlyManager();
        _updateTokenValue();
        uint256 fee = uint256(_performanceFee);
        uint256 amount = 0;
        for (uint256 i = 0; i < holders.length; i++) {
            amount = amount.add(_settlePerformanceFee(holders[i], fee));
        }
        require(amount > 0, "No earnings");
        address pool = _pool;
        _issuePerformanceFee(pool, amount);
        _updateStreamingFeeRate(pool);
        _removeLock();
    }

    /**
     * @notice Withdraws the streaming fee to the fee pool
     */
    function withdrawStreamingFee() external {
        _setLock();
        _issueStreamingFee(_pool);
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
        uint256 fee = _settlePerformanceFeeRecipient(
            account,
            amount,
            uint256(_lastTokenValue),
            uint256(_performanceFee)
        );
        if (fee > 0) _issuePerformanceFee(pool, fee);
        _mint(account, amount);
        _updateStreamingFeeRate(pool);
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
     * @notice Claim rewards using a delegate call to adapter
     * @param adapter The address of the adapter that this function does a delegate call to.
                      It must support the IRewardsAdapter interface and be whitelisted
     * @param token The address of the token being claimed
     */
    function claimRewards(address adapter, address token) external {
        _setLock();
        _onlyManager();
        _delegateClaim(adapter, token);
        _removeLock();
    }

    /**
     * @notice Batch claim rewards using a delegate call to adapters
     * @param adapters The addresses of the adapters that this function does a delegate call to.
                       Adapters must support the IRewardsAdapter interface and be whitelisted
     * @param tokens The addresses of the tokens being claimed
     */
    function batchClaimRewards(address[] memory adapters, address[] memory tokens) external {
        _setLock();
        _onlyManager();
        require(adapters.length == tokens.length, "Incorrect parameters");
        for (uint256 i = 0; i < adapters.length; i++) {
          _delegateClaim(adapters[i], tokens[i]);
        }
        _removeLock();
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
     * @notice Issues the streaming fee to the fee pool. Only callable by controller
     */
    function issueStreamingFee() external override onlyController {
        _issueStreamingFee(_pool);
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

    function updatePerformanceFee(uint16 fee) external override onlyController {
        _performanceFee = fee;
    }

    function updateRebalanceThreshold(uint16 threshold) external override onlyController {
        _rebalanceThreshold = threshold;
    }

    /**
        @notice Update the manager of this Strategy
     */
    function updateManager(address newManager) external override {
        _onlyManager();
        require(newManager != _manager, "Manager already set");
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
        _tradeData[item] = data;
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
                _updateStreamingFeeRate(newPool);
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
        require(msg.sender == factory, "Only StrategyProxyFactory");
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

    function rebalanceThreshold() external view override returns (uint256) {
        return uint256(_rebalanceThreshold);
    }

    function performanceFee() external view override returns (uint256) {
        return uint256(_performanceFee);
    }

    function getPercentage(address item) external view override returns (int256) {
        return _percentage[item];
    }

    function getTradeData(address item) external view override returns (TradeData memory) {
        return _tradeData[item];
    }

    function getPerformanceFeeOwed(address account) external view override returns (uint256) {
        return _getPerformanceFee(account, uint256(_performanceFee));
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
     * @param token The address of the token being claimed
     */
    function _delegateClaim(address adapter, address token) internal {
        _onlyApproved(adapter);
        bytes memory data =
            abi.encodeWithSelector(
                bytes4(keccak256("claim(address)")),
                token
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
        emit RewardsClaimed(adapter, token);
    }

    /**
     * @notice Set the structure of the strategy
     * @param newItems An array of Item structs that will comprise the strategy
     */
    function _setStructure(StrategyItem[] memory newItems) internal {
        address weth = _weth;
        address susd = _susd;
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
        (uint256 total, ) = oracle().estimateStrategy(this);
        _setTokenValue(total, _totalSupply);
    }

    /**
     * @notice Called any time there is a transfer to settle the performance and streaming fees
     */
    function _handleFees(uint256 amount, address sender, address recipient) internal override {
        uint256 fee = uint256(_performanceFee);
        if (fee > 0) {
            uint256 senderPaidValue = _paidTokenValues[sender];
            uint256 recipientPaidValue = _paidTokenValues[recipient];
            if (recipientPaidValue == 0 && senderPaidValue < uint256(-1)) {
                // Note: Since the recipient doesn't have a balance, they can just inherit
                // the sender's balance without having to settle the performance fees and
                // tokens for the manager/fee pool. This only works because we pay fees via
                // inflation, issuing fees now or later dilutes receiver's value either way
                _paidTokenValues[recipient] = senderPaidValue;
            } else {
                address pool = _pool;
                bool isPool = sender == pool || recipient == pool;
                // Streaming fee gets issued whenever iteracting with the pool since the stream fee rate will need to be updated
                if (isPool) _issueStreamingFee(pool);
                // Performance fees
                uint256 mintAmount = _settlePerformanceFee(sender, fee); // Sender's paid token value may be updated here
                senderPaidValue = _paidTokenValues[sender];
                // Pass sender's paid value unless sender is manager/pool, or below last token value
                uint256 tokenValue =
                    senderPaidValue < uint256(-1) && senderPaidValue > uint256(_lastTokenValue)
                        ? senderPaidValue : uint256(_lastTokenValue);
                mintAmount = mintAmount.add(_settlePerformanceFeeRecipient(
                  recipient,
                  amount,
                  tokenValue,
                  fee));
                if (mintAmount > 0) {
                    // Stream fee before any tokens are minted if it hasn't already been issued
                    if (!isPool) _issueStreamingFee(pool);
                    // Mint prformance fee
                    _issuePerformanceFee(pool, mintAmount);
                    // Update streaming fee rate for the new total supply
                    _updateStreamingFeeRate(pool);
                } else if (isPool) {
                    // Update streaming fee rate since the pool balance has changed
                    _updateStreamingFeeRate(pool);
                }
            }
        }
    }

    /**
     * @notice Mints performance fee to the manager and fee pool
     */
    function _issuePerformanceFee(address pool, uint256 amount) internal {
        uint256 poolAmount = amount.mul(POOL_SHARE).div(DIVISOR);
        _mint(pool, poolAmount);
        _mint(_manager, amount.sub(poolAmount));
    }

    /**
     * @notice Mints new tokens to cover the streaming fee based on the time passed since last payment and the current streaming fee rate
     */
    function _issueStreamingFee(address pool) internal {
        uint256 timePassed = block.timestamp.sub(uint256(_lastStreamTimestamp));
        if (timePassed > 0) {
            uint256 amountToMint = uint256(_streamingFeeRate).mul(timePassed).div(YEAR).div(10**18);
            _mint(pool, amountToMint);
            // Note: No need to update _streamingFeeRate as the change in totalSupply and pool balance are equal, causing no change in rate
            _lastStreamTimestamp = uint96(block.timestamp);
            emit StreamingFee(amountToMint);
        }
    }

    /**
     * @notice Sets the new _streamingFeeRate which is the per year amount owed in streaming fees based on the current totalSupply (not counting supply held by the fee pool)
     */
    function _updateStreamingFeeRate(address pool) internal {
        _streamingFeeRate = uint192(_totalSupply.sub(_balances[pool]).mul(STREAM_FEE));
    }

    /**
     * @notice Deduct withdrawal fee and burn remaining tokens. Returns the amount of tokens that have been burned
     */
    function _deductFeeAndBurn(address account, uint256 amount) internal returns (uint256) {
        address pool = _pool;
        amount = _deductWithdrawalFee(account, pool, amount);
        _burn(account, amount);
        _updateStreamingFeeRate(pool);
        return amount;
    }

    /**
     * @notice Deducts the withdrawal fee and returns the remaining token amount
     */
    function _deductWithdrawalFee(address account, address pool, uint256 amount) internal returns (uint256) {
        if (account == pool) return amount;
        uint256 fee = amount.mul(WITHDRAWAL_FEE).div(10**18);
        _transfer(account, pool, fee);
        emit WithdrawalFee(account, fee);
        return amount.sub(fee);
    }

    // Settle performance fee
    function _settlePerformanceFee(address account, uint256 fee) internal returns (uint256) {
        uint256 amount = _getPerformanceFee(account, fee);
        if (amount > 0) {
            _paidTokenValues[account] = uint256(_lastTokenValue);
            emit PerformanceFee(account, amount);
        }
        return amount;
    }

    // Settle performance fee when the account is receiving new tokens
    function _settlePerformanceFeeRecipient(
        address account,
        uint256 amount,
        uint256 tokenValue,
        uint256 fee
    ) internal returns (uint256) {
        uint256 paidTokenValue = _paidTokenValues[account];
        if (paidTokenValue > 0) {
            if (paidTokenValue == uint256(-1)) return 0; // Manager or pool, no settlement necessary
            uint256 lastTokenValue = uint256(_lastTokenValue);
            uint256 balance = _balances[account];
            uint256 mintAmount = 0;
            if (paidTokenValue < lastTokenValue) {
                mintAmount = _calcPerformanceFee(
                    balance,
                    paidTokenValue,
                    lastTokenValue,
                    fee
                );
                // Update the paid token value to the current value
                paidTokenValue = lastTokenValue;
            }
            // Note: paidTokenValue & tokenValue will always equal lastTokenValue or greater
            if (paidTokenValue != tokenValue) {
                // When the amount has a different paid token value than
                // the account's current balance, We need to find the average
                // paid token value.
                _paidTokenValues[account] = _avgPaidTokenValue(balance, amount, paidTokenValue, tokenValue);
            } else if (paidTokenValue == lastTokenValue) {
                // The paid token value was updated above, just set it in state
               _paidTokenValues[account] = paidTokenValue;
            }
            if (mintAmount > 0) emit PerformanceFee(account, mintAmount);
            return mintAmount;
        } else {
            // Check if account is manager or pool
            if (account == _manager || account == _pool) {
                // Manager/pool has not been initialized, set paid token value to max
                _paidTokenValues[account] = uint256(-1);
            } else {
                // It is a user minting for the first time. Set paid token value to current
                _paidTokenValues[account] = tokenValue;
            }
            // No fees need to be issued
            return 0;
        }
    }

    /**
     * @notice Returns the current amount of performance fees owed by the account
     */
    function _getPerformanceFee(address account, uint256 fee) internal view returns (uint256) {
        // We don't need to check pool or manager address since their paid token value is max uint256
        if (uint256(_lastTokenValue) > _paidTokenValues[account])
            return _calcPerformanceFee(
                _balances[account],
                _paidTokenValues[account],
                uint256(_lastTokenValue),
                fee
            );
        return 0;
    }

    /**
     * @notice Calculated performance fee based on the current token value and the amount the user has already paid for
     */
    function _calcPerformanceFee(uint256 balance, uint256 paidTokenValue, uint256 tokenValue, uint256 fee) internal pure returns (uint256) {
        uint256 diff = tokenValue.sub(paidTokenValue);
        return balance.mul(diff).mul(fee).div(DIVISOR).div(tokenValue);
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
        require(whitelist().approved(account), "Not approved");
    }

    function _onlyManager() internal view {
        require(msg.sender == _manager, "Not manager");
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
