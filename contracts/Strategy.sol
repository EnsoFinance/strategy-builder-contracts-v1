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
import "./interfaces/aave/ILendingPool.sol";
import "./interfaces/aave/IDebtToken.sol";

/**
 * @notice This contract holds erc20 tokens, and represents individual account holdings with an erc20 strategy token
 * @dev Strategy token holders can withdraw their assets here or in StrategyController
 */
contract Strategy is IStrategy, IStrategyManagement, StrategyToken, ERC1271, Initializable {
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    using SafeERC20 for IERC20;

    IDelegateApprovals private constant SYNTH_DELEGATE = IDelegateApprovals(0x15fd6e554874B9e70F832Ed37f231Ac5E142362f);
    ILendingPool private constant AAVE_LENDING_POOL = ILendingPool(0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9);
    uint256 public constant WITHDRAWAL_FEE = 2*10**15; // 0.2% per withdraw
    uint256 public constant STREAM_FEE = 10**16; //uint256(10**34)/(uint256(10**18)-uint256(10**16)); // 1% per year
    uint256 private constant YEAR = 365 days;
    uint256 private constant DIVISOR = 1000;

    event Withdraw(uint256 amount, uint256[] amounts);

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

    function approveToken(
        address token,
        address account,
        uint256 amount
    ) external override onlyController {
        IERC20(token).safeApprove(account, amount);
    }

    function approveDebt(
        address token,
        address account,
        uint256 amount
    ) external override onlyController {
        IDebtToken(token).approveDelegation(account, amount);
    }

    function approveSynths(
        address account,
        uint256 amount
    ) external override onlyController {
        IERC20(oracle().susd()).safeApprove(account, amount);
        if (amount == 0) {
            SYNTH_DELEGATE.removeExchangeOnBehalf(account);
        } else {
            SYNTH_DELEGATE.approveExchangeOnBehalf(account);
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
        AAVE_LENDING_POOL.setUserUseReserveAsCollateral(token, true);
    }

    /**
     * @notice Withdraw the underlying assets and burn the equivalent amount of strategy token
     * @param amount The amount of strategy tokens to burn to recover the equivalent underlying assets
     */
    function withdrawAll(uint256 amount) external override {
        _setLock();
        require(_debt.length == 0, "Cannot withdraw debt");
        require(amount > 0, "0 amount");
        amount = _deductWithdrawalFee(msg.sender, amount);
        uint256 percentage = amount.mul(10**18).div(_totalSupply);
        // Burn strategy tokens
        _burn(msg.sender, amount);
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
          for (uint256 i = _items.length; i < numTokens; i ++) {
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
        _removeLock();
    }

    function withdrawStreamingFee() external override {
        _issueStreamingFee(IStrategyProxyFactory(_factory).pool());
    }

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
        _paidTokenValues[account] = _lastTokenValue;
    }

    function burn(address account, uint256 amount) external override onlyController returns (uint256){
        amount = _deductWithdrawalFee(account, amount);
        _burn(account, amount);
        return amount;
    }

    /*
     *
     */
    function delegateSwap(
        address adapter,
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external override onlyController {
        // Note: No reentrancy lock since only callable by _settleSynths function in controller which already locks
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

    function updateTokenValue() public {
        (uint256 total, ) = oracle().estimateStrategy(this);
        _setTokenValue(total);
    }

    function updateTokenValue(uint256 total) external override onlyController {
        _setTokenValue(total);
    }

    /**
        @notice Update the manager of this Strategy
     */
    function updateManager(address newManager) external override {
        _onlyManager();
        _manager = newManager;
    }

    function updateSigner(address signer, bool add) external {
        _onlyManager();
        _signers[signer] = add ? 1 : 0;
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
        uint256 balance = _balances[account];
        if (balance == 0) return 0;
        if (account == IStrategyProxyFactory(_factory).pool()) return balance;
        if (_lastTokenValue > _paidTokenValues[account])
            return balance.sub(_calcPerformanceFee(
                balance,
                _paidTokenValues[account],
                _lastTokenValue,
                IStrategyController(_controller).performanceFee(address(this)))
            );
        return balance;
    }

    function _setTokenValue(uint256 total) internal {
        if(_totalSupply > 0) _lastTokenValue = total.mul(10**18).div(_totalSupply);
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
        for (uint256 i = 0; i < _items.length; i++) {
            delete _percentage[_items[i]];
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

    function _handleFees(address sender, address recipient) internal override {
        // Streaming fee
        address pool = IStrategyProxyFactory(_factory).pool();
        _issueStreamingFee(pool);
        // Performance fees
        uint256 performanceFee = IStrategyController(_controller).performanceFee(address(this));
        uint256 amount = _deductPerformanceFee(sender, pool, performanceFee);
        amount = amount.add(_deductPerformanceFee(recipient, pool, performanceFee));
        if (amount > 0) _distributePerformanceFee(pool, amount);
    }

    function _issueStreamingFee(address pool) internal {
        uint256 timePassed = block.timestamp.sub(_lastStreamTimestamp);
        if (timePassed > 0) {
            uint256 feePercent = uint256(10**36).div(uint256(10**18).sub(STREAM_FEE.mul(timePassed).div(YEAR))).sub(10**18);
            uint256 amountToMint = _totalSupply.mul(feePercent).div(10**18);
            _mint(pool, amountToMint);
            _lastStreamTimestamp = block.timestamp;
        }
    }

    function _deductWithdrawalFee(address account, uint256 amount) internal returns (uint256) {
        address pool = IStrategyProxyFactory(_factory).pool();
        if (account == pool) return amount;
        uint256 fee = amount.mul(WITHDRAWAL_FEE).div(10**18);
        _transfer(account, pool, fee);
        return amount.sub(fee);
    }

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
              return amount;
            }
        }
        return 0;
    }

    function _distributePerformanceFee(address pool, uint256 amount) internal {
        uint256 poolAmount = amount.mul(300).div(DIVISOR);
        _balances[_manager] = _balances[_manager].add(amount.sub(poolAmount));
        _balances[pool] = _balances[pool].add(poolAmount);
        emit Transfer(_manager, pool, poolAmount);
    }

    function _calcPerformanceFee(uint256 balance, uint256 paidTokenValue, uint256 tokenValue, uint256 performanceFee) internal pure returns (uint256){
        uint256 diff = tokenValue.sub(paidTokenValue);
        return balance.mul(diff).mul(performanceFee).div(DIVISOR).div(10**18);
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
