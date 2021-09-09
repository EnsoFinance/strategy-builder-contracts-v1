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
    uint256 private constant DIVISOR = 1000;

    event Withdraw(uint256 amount, uint256[] amounts);
    event Deposit(uint256 value, uint256 amount);

    // Initialize constructor to disable implementation
    constructor() public initializer {} //solhint-disable-line

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
        require(whitelist().approved(msg.sender), "Not approved");
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

    function withdrawWeth(
        uint256 amount,
        IStrategyRouter router,
        bytes memory data
    ) external override {
        _setLock();
        require(amount > 0, "0 amount");
        address weth = oracle().weth();
        uint256 wethBefore = IERC20(weth).balanceOf(address(this));
        (uint256 totalBefore, ) = oracle().estimateStrategy(this);
        uint256 percentage = amount.mul(10**18).div(_totalSupply);
        uint256 expectedWeth = totalBefore.mul(percentage).div(10**18);
        // Burn strategy tokens
        _burn(msg.sender, amount);
        // Approve items
        for (uint256 i = 0; i < _items.length; i++) {
            IERC20(_items[i]).safeApprove(address(router), uint256(-1));
        }
        for (uint256 i = 0; i < _debt.length; i++) {
            IDebtToken(_debt[i]).approveDelegation(address(router), uint256(-1));
        }
        // Withdraw
        if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
            data = abi.encode(percentage);
        router.withdraw(address(this), data);
        // Revoke items approval
        for (uint256 i = 0; i < _items.length; i++) {
            IERC20(_items[i]).safeApprove(address(router), uint256(0));
        }
        for (uint256 i = 0; i < _debt.length; i++) {
            IDebtToken(_debt[i]).approveDelegation(address(router), uint256(0));
        }
        uint256 wethDiff = IERC20(weth).balanceOf(address(this))
            .sub(wethBefore.sub(wethBefore.mul(percentage).div(10**18))); // weth after - (weth before - percentage of weth withdrawn)
        IERC20(weth).safeTransfer(msg.sender, wethDiff);
        (uint256 totalAfter, ) = oracle().estimateStrategy(this);
        uint256 valueRemoved = totalBefore.sub(totalAfter);
        uint256 slippage = IStrategyController(_controller).slippage(address(this));
        require(valueRemoved.mul(slippage).div(DIVISOR) <= expectedWeth, "Too much removed");
        require(
            valueRemoved >=
                expectedWeth.mul(slippage).div(DIVISOR),
            "Too much slippage"
        );
        //emit Withdraw(amount, amounts);
        _removeLock();
    }

    /**
     * @notice Deposit ether, which is traded for the underlying assets, and mint strategy tokens
     * @param router The address of the router that will be doing the handling the trading logic
     * @param data The calldata for the router's deposit function
     */
    function deposit(
        uint256 amount,
        IStrategyRouter router,
        bytes memory data
    ) external payable override {
        _setLock();
        _socialOrManager();
        (uint256 totalBefore, ) = oracle().estimateStrategy(this);
        _deposit(msg.sender, amount, totalBefore, router, data);
        _removeLock();
    }

    function depositFromController(
        address account,
        IStrategyRouter router,
        bytes memory data
    ) external payable override onlyController {
        _setLock();
        _deposit(account, msg.value, 0, router, data);
        _removeLock();
    }

    function claimRewards(address adapter, address token) external {
        _setLock();
        require(msg.sender == _manager, "Not manager");
        require(whitelist().approved(adapter), "Not approved");
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

    function settleSynths(address adapter, address token) external {
        //Ensure we have an approved adapter before calling _unsafeDelegateSwap
        require(msg.sender == _manager, "Not manager");
        require(whitelist().approved(adapter), "Not approved");
        address susd = oracle().susd();
        if (token == susd) {
            for (uint256 i = 0; i < _synths.length; i++) {
                require(
                    _unsafeDelegateSwap(
                        adapter,
                        IERC20(_synths[i]).balanceOf(address(this)),
                        _synths[i],
                        susd
                    ),
                    "Swap failed"
                );
            }
        } else if (token == address(-1)) {
            uint256 susdBalance = IERC20(susd).balanceOf(address(this));
            int256 percentTotal = _percentage[address(-1)];
            for (uint256 i = 0; i < _synths.length; i++) {
                require(
                    _unsafeDelegateSwap(
                        adapter,
                        uint256(int256(susdBalance).mul(_percentage[_synths[i]]).div(percentTotal)),
                        susd,
                        _synths[i]
                    ),
                    "Swap failed"
                );
            }
        } else {
            revert("Unsupported token");
        }
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function mint(address account, uint256 amount) external override onlyController {
        _mint(account, amount);
    }

    /**
        @notice Update the manager of this Strategy
     */
    function updateManager(address newManager) external override {
        require(msg.sender == _manager, "Not manager");
        _manager = newManager;
    }

    /**
        @notice Update an item's trade data
     */
    function updateTradeData(address item, TradeData memory data) external override {
        require(msg.sender == _manager, "Not manager");
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

    function getCategory(address item) external view override returns (EstimatorCategory) {
        return EstimatorCategory(oracle().tokenRegistry().estimatorCategories(item));
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

    function _deposit(
        address account,
        uint256 amount,
        uint256 totalBefore,
        IStrategyRouter router,
        bytes memory data
    ) internal {
        _onlyApproved(address(router));

        IOracle o = oracle();
        if (supportsSynths()) SYNTH_DELEGATE.approveExchangeOnBehalf(address(router));
        for (uint256 i = 0; i < _debt.length; i++) {
            IDebtToken(_debt[i]).approveDelegation(address(router), uint256(-1));
        }

        if (msg.value > 0) {
          amount = msg.value;
          address weth = o.weth();
          IWETH(weth).deposit{value: msg.value}();
          IERC20(weth).safeApprove(address(router), msg.value);
          if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
              data = abi.encode(address(this), msg.value);
          router.deposit(address(this), data);
          IERC20(weth).safeApprove(address(router), 0);
        } else {
          if (router.category() != IStrategyRouter.RouterCategory.GENERIC)
              data = abi.encode(account, amount);
          router.deposit(address(this), data);
        }
        if (supportsSynths()) SYNTH_DELEGATE.removeExchangeOnBehalf(address(router));
        for (uint256 i = 0; i < _debt.length; i++) {
            IDebtToken(_debt[i]).approveDelegation(address(router), 0);
        }

        // Recheck total
        (uint256 totalAfter, ) = o.estimateStrategy(this);
        require(totalAfter > totalBefore, "Lost value");
        uint256 valueAdded = totalAfter - totalBefore; // Safe math not needed, already checking for underflow
        require(
            valueAdded >=
                amount.mul(IStrategyController(_controller).slippage(address(this))).div(DIVISOR),
            "Value slipped"
        );
        uint256 relativeTokens =
            _totalSupply > 0 ? _totalSupply.mul(valueAdded).div(totalBefore) : totalAfter;
        _mint(account, relativeTokens);
        emit Deposit(amount, relativeTokens);
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

    /*
     * @warning This function does not validate the adapter, please do so before calling
     */
    function _unsafeDelegateSwap(
        address adapter,
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) private returns (bool success) {
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
        assembly {
            success := delegatecall(txGas, adapter, add(swapData, 0x20), mload(swapData), 0, 0)
        }
    }

    /**
     * @notice Confirm signer is permitted to sign on behalf of contract
     * @param signer The address of the message signer
     * @return Bool confirming whether signer is permitted
     */
    function _checkSigner(address signer) internal view override returns (bool) {
        return signer == _manager;
    }

    /**
     * @notice Checks that router is whitelisted
     */
    function _onlyApproved(address router) internal view {
        require(whitelist().approved(router), "Router not approved");
    }

    /**
     * @notice Checks if strategy is social or else require msg.sender is manager
     */
    function _socialOrManager() internal view {
        require(
            msg.sender == _manager || IStrategyController(_controller).social(address(this)),
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
