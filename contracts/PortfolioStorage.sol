//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;


contract PortfolioStorage { //solhint-disable
    // ALERT: Do not reorder variables on upgrades! Append only
    // EIP712
    //bytes32 public DOMAIN_SEPARATOR;
    //bytes32 public PERMIT_TYPEHASH;
    // Ownable
    address internal _owner;
    // ERC20
    mapping (address => uint256) internal _balances;
    //mapping (address => uint256) internal _nonces;
    mapping (address => mapping (address => uint256)) internal _allowances;
    uint256 internal _totalSupply;
    string internal _name;
    string internal _symbol;
    //uint256 internal _version;
    uint8 internal _decimals;
    // Portfolio
    address internal _oracle;
    address internal _whitelist;

    bool internal _locked;
    bool internal _social;

    uint256 internal _rebalanceThreshold;
    uint256 internal _slippage;
    uint256 internal _timelock;
    uint256 internal _restructureTimestamp;
    bytes32 internal _restructureProof;

    address[] internal _tokens;
    mapping(address => uint256) internal _tokenPercentages;

    // Reserved storage space to allow for layout changes in the future.
    uint256[50] private __gap;
}
