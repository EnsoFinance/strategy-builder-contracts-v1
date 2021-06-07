//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./ERC1271.sol";
import "./StrategyToken.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IStrategyProxyFactory.sol";
import "./interfaces/IWhitelist.sol";

/**
 * @notice This contract holds erc20 tokens, and represents individual account holdings with an erc20 strategy token
 * @dev Strategy token holders can withdraw their assets here or in StrategyController
 */
contract Strategy is IStrategy, StrategyToken, ERC1271, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant DIVISOR = 1000;

    event Withdraw(uint256 amount, uint256[] amounts);

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
        address[] memory strategyItems_,
        uint256[] memory percentages_
    ) external initializer returns (bool) {
        _controller = controller_;
        _manager = manager_;
        _factory = msg.sender;
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
            verifyStructure(strategyItems_, percentages_);
            _setStructure(strategyItems_, percentages_);
        }
        return true;
    }

    function approveToken(
        IERC20 token,
        address account,
        uint256 amount
    ) external override onlyController {
        token.safeApprove(account, amount);
    }

    function approveTokens(address account, uint256 amount) external override onlyController {
        for (uint256 i = 0; i < _strategyItems.length; i++) {
            IERC20(_strategyItems[i]).safeApprove(account, amount);
        }
    }

    /**
     * @notice Set the structure of the strategy
     * @param newItems An array of token addresses that will comprise the strategy
     * @param newPercentages An array of percentages for each token in the above array. Must total 100%
     */
    function setStructure(address[] memory newItems, uint256[] memory newPercentages)
        external
        override
        onlyController
    {
        _setStructure(newItems, newPercentages);
    }

    /**
     * @notice Withdraw the underlying assets and burn the equivalent amount of strategy token
     * @param amount The amount of strategy tokens to burn to recover the equivalent underlying assets
     */
    function withdraw(uint256 amount) external override {
        _setLock();
        require(amount > 0, "0 amount");
        uint256 percentage = amount.mul(10**18).div(_totalSupply);
        _burn(msg.sender, amount);
        uint256[] memory amounts = new uint256[](_strategyItems.length);
        for (uint256 i = 0; i < _strategyItems.length; i++) {
            // Should not be possible to have address(0) since the Strategy will check for it
            IERC20 token = IERC20(_strategyItems[i]);
            uint256 currentBalance = token.balanceOf(address(this));
            uint256 tokenAmount = currentBalance.mul(percentage).div(10**18);
            token.safeTransfer(msg.sender, tokenAmount);
            amounts[i] = tokenAmount;
        }
        emit Withdraw(amount, amounts);
        _removeLock();
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

    function items() external view override returns (address[] memory) {
        return _strategyItems;
    }

    function percentage(address strategyItem) external view override returns (uint256) {
        return _percentages[strategyItem];
    }

    function isWhitelisted(address account) external view override returns (bool) {
        return IWhitelist(whitelist()).approved(account);
    }

    function controller() external view override returns (address) {
        return _controller;
    }

    function manager() external view override returns (address) {
        return _manager;
    }

    function oracle() external view override returns (address) {
        return IStrategyProxyFactory(_factory).oracle();
    }

    function whitelist() public view override returns (address) {
        return IStrategyProxyFactory(_factory).whitelist();
    }

    /**
     * @dev Updates implementation version
     */
    function updateVersion(string memory newVersion) external {
        require(msg.sender == _factory, "Only StrategyFactory");
        _version = newVersion;
        _setDomainSeperator();
    }

    /**
     * @notice This function verifies that the structure passed in parameters is valid
     * @dev We check that the array lengths match, that the percentages add 100%,
     *      no zero addresses, and no duplicates
     * @dev Token addresses must be passed in, according to increasing byte value
     */
    function verifyStructure(address[] memory newItems, uint256[] memory newPercentages)
        public
        pure
        override
        returns (bool)
    {
        require(newItems.length > 0, "Cannot set empty structure");
        require(newItems.length == newPercentages.length, "Invalid input lengths");
        require(newItems[0] != address(0), "Invalid item addr"); //Everything else will caught be the ordering requirement below
        uint256 total = 0;
        for (uint256 i = 0; i < newItems.length; i++) {
            require(i == 0 || newItems[i] > newItems[i - 1], "Item ordering");
            require(newPercentages[i] > 0, "0 percentage provided");
            total = total.add(newPercentages[i]);
        }
        require(total == DIVISOR, "Total percentage wrong");
        return true;
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
     * @param newItems An array of token addresses that will comprise the strategy
     * @param newPercentages An array of percentages for each token in the above array. Must total 100%
     */
    function _setStructure(address[] memory newItems, uint256[] memory newPercentages) internal {
        // Remove old percentages
        for (uint256 i = 0; i < _strategyItems.length; i++) {
            delete _percentages[_strategyItems[i]];
        }
        for (uint256 i = 0; i < newItems.length; i++) {
            _percentages[newItems[i]] = newPercentages[i];
        }
        _strategyItems = newItems;
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
