//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IStrategyToken.sol";

import "./StrategyTokenStorage__WIP.sol";
import "./StrategyTokenBase.sol";
import "./StrategyFees.sol";

contract StrategyToken is IStrategyToken, StrategyTokenStorage__WIP, StrategyTokenBase, StrategyFees, Initializable {

    constructor(address factory_, address controller_) public StrategyCommon(factory_, controller_) {
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
        uint256 totalSupply,
        uint128 lastTokenValue
    ) external override initializer returns (bool) {
        _strategy = msg.sender; 
        _manager = manager_;
        _name = name_;
        _symbol = symbol_;
        _version = version_;
        _totalSupply = totalSupply; // inherits total supply from `Strategy` for first migration. future token->token migrations will need updated "migrate" function
        _lastTokenValue = lastTokenValue; // inherits similarly
        _lastTokenValue = uint128(PRECISION);
        _lastStreamTimestamp = uint96(block.timestamp);
        _paidTokenValues[manager_] = uint256(-1);
        _setDomainSeperator();
        updateAddresses();
        return true;
    }

    function migrateDeprecated(
        bytes32 DOMAIN_SEPARATOR_,
        uint224 streamingFeeRate_,
        uint16 performanceFee_,
        uint96 lastStreamTimestamp_,
        uint128 lastTokenValue_,
        uint256 managementFee_,
        uint256 managementFeeRate_
    ) external override {
        _onlyStrategy();
        // strategy ensures this happens only once!
        DOMAIN_SEPARATOR = DOMAIN_SEPARATOR_;
        _streamingFeeRate = streamingFeeRate_;
        _performanceFee = performanceFee_;
        _lastStreamTimestamp = lastStreamTimestamp_;
        _lastTokenValue = lastTokenValue_;
        _managementFee = managementFee_;
        _managementFeeRate = managementFeeRate_;
    }

    function migrateAccount(address account, uint256 balance, uint256 nonce, uint256 paidTokenValue) external override {
        _onlyStrategy();
        // strategy checks this only happens once
        _balances[account] = balance;
        _nonces[account] = nonce;
        _paidTokenValues[account] = paidTokenValue;
    }

    /**
     * notice Mint new tokens. Only callable by controller
     * param account The address of the account getting new tokens
     * param amount The amount of tokens being minted
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
     * notice Burn tokens. Only callable by controller
     * param account The address of the account getting tokens removed
     * param amount The amount of tokens being burned
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

    function strategy() external view override returns(IStrategy) {
        return IStrategy(_strategy);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        address pool = _pool;
        address manager = _manager;
        bool rateChange;
        // We're not currently supporting performance fees but don't want to exclude it in the future.
        // So users are getting grandfathered in by setting their paid token value to the avg token
        // value they bought into
        if (sender == manager || sender == pool) {
            rateChange = true;
        } else {
            _removePaidTokenValue(sender, amount);
        }
        if (recipient == manager || recipient == pool) {
            rateChange = true;
        } else {
            _updatePaidTokenValue(recipient, amount, _lastTokenValue);
        }
        if (rateChange) _issueStreamingFee(pool, manager);
        super._transfer(sender, recipient, amount);
        if (rateChange) _updateStreamingFeeRate(pool, manager);
    }

    function _onlyStrategy() internal override {
        if (msg.sender != _strategy) revert("_onlyStrategy.");
    }

    function _onlyControllerOrStrategy() internal override {
        if (!(msg.sender == _controller || msg.sender == _strategy)) revert("_onlyControllerOrStrategy.");
    } 
}
