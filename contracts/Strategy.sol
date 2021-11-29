//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "./ERC1271.sol";
import "./StrategyToken.sol";
import "./libraries/StrategyLibrary.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IStrategyManagement.sol";
import "./interfaces/IStrategyController.sol";
import "./interfaces/IStrategyProxyFactory.sol";
import "./interfaces/synthetix/IDelegateApprovals.sol";
import "./interfaces/synthetix/IExchanger.sol";
import "./interfaces/synthetix/IIssuer.sol";
import "./interfaces/aave/ILendingPool.sol";
import "./interfaces/aave/IDebtToken.sol";

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
contract Strategy is IStrategy, IStrategyManagement, StrategyToken, ERC1271, Initializable {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;

    ISynthetixAddressResolver private constant SYNTH_RESOLVER = ISynthetixAddressResolver(0x823bE81bbF96BEc0e25CA13170F5AaCb5B79ba83);
    IAaveAddressResolver private constant AAVE_RESOLVER = IAaveAddressResolver(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5);
    uint256 public constant WITHDRAWAL_FEE = 2*10**15; // 0.2% per withdraw
    uint256 public constant STREAM_FEE = uint256(10**34)/uint256(10**18-10**16); // 0.1% yearly inflation
    uint256 private constant YEAR = 365 days;
    uint256 private constant DIVISOR = 1000;


    event Withdraw(uint256 amount, uint256[] amounts);
    event UpdateManager(address manager);
    event UpdateSigner(address signer, bool added);
    event PerformanceFee(address account, uint256 amount);
    event WithdrawalFee(address account, uint256 amount);
    event StreamingFee(uint256 amount);

    // Initialize constructor to disable implementation
    constructor() public initializer {}

    /**
     * @dev Throws if called by any account other than the controller.
     */
    modifier onlyController() {
        require(_controller == msg.sender, "Controller only");
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
        address controller_,
        address manager_,
        StrategyItem[] memory strategyItems_
    ) external override initializer returns (bool) {
        _controller = controller_;
        _factory = msg.sender;
        _manager = manager_;
        _name = name_;
        _symbol = symbol_;
        _decimals = 18;
        _version = version_;
        _lastTokenValue = 10**18;
        _lastStreamTimestamp = block.timestamp;
        PERMIT_TYPEHASH = keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
        _setDomainSeperator();
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
    ) external override onlyController {
        IERC20(token).safeApprove(account, amount);
    }

    /**
     * @notice Strategy approves another account to take out debt. Only called by controller
     * @param token The address of the Aave DebtToken
     * @param account The address of the account to be approved
     * @param amount The amount to be approved
     */
    function approveDebt(
        address token,
        address account,
        uint256 amount
    ) external override onlyController {
        IDebtToken(token).approveDelegation(account, amount);
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
        IERC20(oracle().susd()).safeApprove(account, amount);
        IDelegateApprovals delegateApprovals = IDelegateApprovals(SYNTH_RESOLVER.getAddress("DelegateApprovals"));
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

    function setCollateral(address token) external override {
        _onlyApproved(msg.sender);
        ILendingPool(AAVE_RESOLVER.getLendingPool()).setUserUseReserveAsCollateral(token, true);
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
        IOracle o = oracle();
        uint256 numTokens = supportsSynths() ? _items.length + _synths.length + 2 : _items.length + 1;
        IERC20[] memory tokens = new IERC20[](numTokens);
        uint256[] memory amounts = new uint256[](numTokens);
        for (uint256 i = 0; i < _items.length; i++) {
            // Should not be possible to have address(0) since the Strategy will check for it
            IERC20 token = IERC20(_items[i]);
            uint256 currentBalance = token.balanceOf(address(this));
            amounts[i] = currentBalance.mul(percentage).div(10**18);
            tokens[i] = token;
        }
        if (supportsSynths()) {
            for (uint256 i = _items.length; i < numTokens - 2; i ++) {
                IERC20 synth = IERC20(_synths[i - _items.length]);
                uint256 currentBalance = synth.balanceOf(address(this));
                amounts[i] = currentBalance.mul(percentage).div(10**18);
                tokens[i] = synth;
            }
            // Include SUSD
            IERC20 susd = IERC20(o.susd());
            uint256 susdBalance = susd.balanceOf(address(this));
            amounts[numTokens - 2] = susdBalance.mul(percentage).div(10**18);
            tokens[numTokens - 2] = susd;
        }
        // Include WETH
        IERC20 weth = IERC20(o.weth());
        uint256 wethBalance = weth.balanceOf(address(this));
        amounts[numTokens - 1] = wethBalance.mul(percentage).div(10**18);
        tokens[numTokens - 1] = weth;
        // Transfer amounts
        for (uint256 i = 0; i < numTokens; i++) {
            if (amounts[i] > 0) tokens[i].safeTransfer(msg.sender, amounts[i]);
        }
        emit Withdraw(amount, amounts);
        _removeLock();
    }

    /**
     * @notice Withdraws the performance fee to the manager and the fee pool
     * @param holders An array of accounts that will have the performance fees removed
     */
    function withdrawPerformanceFee(address[] memory holders) external {
        _setLock();
        _onlyManager();
        updateTokenValue();
        address pool = IStrategyProxyFactory(_factory).pool();
        uint256 performanceFee = IStrategyController(_controller).performanceFee(address(this));
        uint256 amount = 0;
        for (uint256 i = 0; i < holders.length; i++) {
            amount = amount.add(_deductPerformanceFee(holders[i], pool, performanceFee));
        }
        require(amount > 0, "No earnings");
        _distributePerformanceFee(pool, amount);
        _updateStreamingFeeRate(pool);
        _removeLock();
    }

    /**
     * @notice Withdraws the streaming fee to the fee pool
     */
    function withdrawStreamingFee() external override {
        _issueStreamingFee(IStrategyProxyFactory(_factory).pool());
    }

    /**
     * @notice Mint new tokens. Only callable by controller
     * @param account The address of the account getting new tokens
     * @param amount The amount of tokens being minted
     */
    function mint(address account, uint256 amount) external override onlyController {
        //Assumes updateTokenValue has been called
        address pool = IStrategyProxyFactory(_factory).pool();
        uint256 fee = _deductPerformanceFee(
            account,
            pool,
            IStrategyController(_controller).performanceFee(address(this))
        );
        if (fee > 0) _distributePerformanceFee(pool, fee);
        _mint(account, amount);
        _updateStreamingFeeRate(pool);
        _paidTokenValues[account] = _lastTokenValue;
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
        require(success, "Swap failed");
    }

    /**
     * @notice Claim rewards using a delegate call to an adapter
     * @param adapter The address of the adapter that this function does a delegate call to. It must support the IRewardsAdapter interface and be whitelisted
     * @param token The address of the token being claimed
     */
    function delegateClaimRewards(address adapter, address token) external {
        _setLock();
        _onlyManager();
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
        require(success, "Claim failed");
        _removeLock();
    }

    /**
     * @notice Settle the amount held for each Synth after an exchange has occured and the oracles have resolved a price
     */
    function settleSynths() public override {
        if (supportsSynths()) {
            IExchanger exchanger = IExchanger(SYNTH_RESOLVER.getAddress("Exchanger"));
            IIssuer issuer = IIssuer(SYNTH_RESOLVER.getAddress("Issuer"));
            exchanger.settle(address(this), "sUSD");
            for (uint256 i = 0; i < _synths.length; i++) {
                exchanger.settle(address(this), issuer.synthsByAddress(ISynth(_synths[i]).target()));
            }
        }
    }

    /**
     * @notice Update the per token value based on the most recent strategy value.
     */
    function updateTokenValue() public {
        (uint256 total, ) = oracle().estimateStrategy(this);
        _setTokenValue(total, _totalSupply);
    }

    /**
     * @notice Update the per token value based on the most recent strategy value. Only callable by controller
     * @param total The current total value of the strategy in WETH
     * @param supply The new supply of the token (updateTokenValue needs to be called before mint, so the new supply has to be passed in)
     */
    function updateTokenValue(uint256 total, uint256 supply) external override onlyController {
        _setTokenValue(total, supply);
    }

    /**
        @notice Update the manager of this Strategy
     */
    function updateManager(address newManager) external override {
        _onlyManager();
        _manager = newManager;
        emit UpdateManager(newManager);
    }

    function updateSigner(address signer, bool add) external {
        _onlyManager();
        _signers[signer] = add ? 1 : 0;
        emit UpdateSigner(signer, add);
    }

    /**
        @notice Update an item's trade data
     */
    function updateTradeData(address item, TradeData memory data) external override {
        _onlyManager();
        _tradeData[item] = data;
    }

    /**
     * @dev Updates implementation version
     */
    function updateVersion(string memory newVersion) external override {
        require(msg.sender == _factory, "Only StrategyProxyFactory");
        _version = newVersion;
        _setDomainSeperator();
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

    function getPercentage(address item) external view override returns (int256) {
        return _percentage[item];
    }

    function getTradeData(address item) external view override returns (TradeData memory) {
        return _tradeData[item];
    }

    function getPerformanceFeeOwed(address account) external view override returns (uint256) {
        return _getPerformanceFee(account);
    }

    function controller() external view override returns (address) {
        return _controller;
    }

    function manager() external view override(IStrategy, IStrategyManagement) returns (address) {
        return _manager;
    }

    function oracle() public view override returns (IOracle) {
        return IOracle(IStrategyProxyFactory(_factory).oracle());
    }

    function whitelist() public view override returns (IWhitelist) {
        return IWhitelist(IStrategyProxyFactory(_factory).whitelist());
    }

    function supportsSynths() public view override returns (bool) {
        return _synths.length > 0;
    }

    function balanceOf(address account) external view override(StrategyToken, IERC20NonStandard) returns (uint256) {
        uint256 performanceFee = _getPerformanceFee(account);
        return _balances[account].sub(performanceFee);
    }

    function lastTokenValue() external view returns (uint256) {
        return _lastTokenValue;
    }

    function paidTokenValue(address account) external view returns (uint256) {
        return _paidTokenValues[account];
    }

    function _setDomainSeperator() internal {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(_name)),
                keccak256(bytes(_version)),
                chainId(),
                address(this)
            )
        );
    }

    /**
     * @notice Set the structure of the strategy
     * @param newItems An array of Item structs that will comprise the strategy
     */
    function _setStructure(StrategyItem[] memory newItems) internal {
        IOracle o = oracle();
        ITokenRegistry registry = o.tokenRegistry();
        address weth = o.weth();
        address susd = o.susd();

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

        // Set new structure

        int256 virtualPercentage = 0;
        //Set new items
        for (uint256 i = 0; i < newItems.length; i++) {
            address newItem = newItems[i].item;
            _tradeData[newItem] = newItems[i].data;
            _percentage[newItem] = newItems[i].percentage;
            ItemCategory category = ItemCategory(registry.itemCategories(newItem));
            if (category == ItemCategory.BASIC) {
                _items.push(newItem);
            } else if (category == ItemCategory.SYNTH) {
                virtualPercentage = virtualPercentage.add(_percentage[newItem]);
                _synths.push(newItem);
            } else if (category == ItemCategory.DEBT) {
                _debt.push(newItem);
            }
        }
        if (virtualPercentage > 0) {
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
        if (supply > 0) _lastTokenValue = total.mul(10**18).div(supply);
    }

    /**
     * @notice Called any time there is a transfer to settle the performance and streaming fees
     */
    function _handleFees(address sender, address recipient) internal override {
        // Get fee pool
        address pool = IStrategyProxyFactory(_factory).pool();
        // Streaming fee
        _issueStreamingFee(pool);
        // Performance fees
        uint256 performanceFee = IStrategyController(_controller).performanceFee(address(this));
        uint256 amount = _deductPerformanceFee(sender, pool, performanceFee);
        amount = amount.add(_deductPerformanceFee(recipient, pool, performanceFee));
        if (amount > 0) {
            _distributePerformanceFee(pool, amount);
            _updateStreamingFeeRate(pool);
        }
    }

    /**
     * @notice Sets the new _streamingFeeRate which is the per year amount owed in streaming fees based on the current totalSupply (not counting supply held by the fee pool)
     */
    function _updateStreamingFeeRate(address pool) internal {
        _streamingFeeRate = _totalSupply.sub(_balances[pool]).mul(STREAM_FEE);
    }

    /**
     * @notice Mints new tokens to cover the streaming fee based on the time passed since last payment and the current streaming fee rate
     */
    function _issueStreamingFee(address pool) internal {
        uint256 timePassed = block.timestamp.sub(_lastStreamTimestamp);
        if (timePassed > 0) {
            uint256 amountToMint = _streamingFeeRate.mul(timePassed).div(YEAR).div(10**18);
            _mint(pool, amountToMint);
            // Note: No need to update _streamingFeeRate as the change in totalSupply and pool balance are equal, causing no change in rate
            _lastStreamTimestamp = block.timestamp;
            emit StreamingFee(amountToMint);
        }
    }

    /**
     * @notice Deduct withdrawal fee and burn remaining tokens. Returns the amount of tokens that have been burned
     */
    function _deductFeeAndBurn(address account, uint256 amount) internal returns (uint256) {
        address pool = IStrategyProxyFactory(_factory).pool();
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

    /**
     * @notice Deducts the performance fee from the account balance and returns the amount deducted
     */
    function _deductPerformanceFee(address account, address pool, uint256 performanceFee) internal returns (uint256){
        if (account == pool) return 0;
        uint256 paidTokenValue = _paidTokenValues[account];
        if (paidTokenValue == 0) {
            _paidTokenValues[account] = _lastTokenValue;
            return 0;
        } else if (_lastTokenValue > paidTokenValue) {
            uint256 balance = _balances[account];
            uint256 amount = _calcPerformanceFee(balance, paidTokenValue, _lastTokenValue, performanceFee);
            if (amount > 0) {
              _paidTokenValues[account] = _lastTokenValue;
              _balances[account] = balance.sub(amount);
              emit Transfer(account, _manager, amount);
              emit PerformanceFee(account, amount);
              return amount;
            }
        }
        return 0;
    }

    /**
     * @notice Distributes performance fees that have already been deducted by _deductPerformanceFee and sends them to the manager and fee pool
     */
    function _distributePerformanceFee(address pool, uint256 amount) internal {
        uint256 poolAmount = amount.mul(300).div(DIVISOR);
        _balances[_manager] = _balances[_manager].add(amount.sub(poolAmount));
        _balances[pool] = _balances[pool].add(poolAmount);
        emit Transfer(_manager, pool, poolAmount);
    }

    /**
     * @notice Returns the current amount of performance fees owed by the account
     */
    function _getPerformanceFee(address account) internal view returns (uint256) {
        if (_balances[account] > 0) {
          if (account == IStrategyProxyFactory(_factory).pool()) return 0;
          if (_lastTokenValue > _paidTokenValues[account])
              return _calcPerformanceFee(
                  _balances[account],
                  _paidTokenValues[account],
                  _lastTokenValue,
                  IStrategyController(_controller).performanceFee(address(this))
              );
        }
        return 0;
    }

    /**
     * @notice Calculated performance fee based on the current token value and the amount the user has already paid for
     */
    function _calcPerformanceFee(uint256 balance, uint256 paidTokenValue, uint256 tokenValue, uint256 performanceFee) internal pure returns (uint256) {
        uint256 diff = tokenValue.sub(paidTokenValue);
        return balance.mul(diff).mul(performanceFee).div(DIVISOR).div(tokenValue);
    }

    /**
     * @notice Confirm signer is permitted to sign on behalf of contract
     * @param signer The address of the message signer
     * @return Bool confirming whether signer is permitted
     */
    function _checkSigner(address signer) internal view override returns (bool) {
        if (signer == _manager) return true;
        return _signers[signer] > 0;
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
