//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./StrategyToken.sol";
import "./interfaces/IStrategy.sol";
import "./interfaces/IStrategyProxyFactory.sol";
import "./interfaces/IWhitelist.sol";

/**
 * @notice This contract holds erc20 tokens, and represents individual account holdings with an erc20 strategy token
 * @dev Strategy token holders can withdraw their assets here or in StrategyController
 */
contract Strategy is IStrategy, StrategyToken, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant DIVISOR = 1000;

    // Initialize constructor to disable implementation
    constructor() public initializer {}

    /**
     * @dev Throws if called by any account other than the controller.
     */
    modifier onlyController() {
        require(_controller == msg.sender, "S.oC: controller only");
        _;
    }

    /**
     * @notice Initializes new Strategy
     * @dev Should be called from the StrategyProxyFactory  (see StrategyProxyFactory._createProxy())
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 version_,
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
        PERMIT_TYPEHASH = keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,uint256 version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(name_)),
                version_,
                chainId(),
                address(this)
            )
        );
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

    function transferToken(
        IERC20 token,
        address account,
        uint256 amount
    ) external override onlyController {
        token.safeTransfer(account, amount);
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
        require(amount > 0, "S.withdraw: 0 amount");
        uint256 percentage = amount.mul(10**18).div(_totalSupply);
        _burn(msg.sender, amount);
        for (uint256 i = 0; i < _strategyItems.length; i++) {
            // Should not be possible to have address(0) since the Strategy will check for it
            IERC20 token = IERC20(_strategyItems[i]);
            uint256 currentBalance = token.balanceOf(address(this));
            uint256 tokenAmount = currentBalance.mul(percentage).div(10**18);
            token.safeTransfer(msg.sender, tokenAmount);
        }
    }

    /**
        @notice Update the manager of this Strategy
     */
    function updateManager(address newManager) external override {
        require(msg.sender == _manager, "S.uM: Not manager");
        _manager = newManager;
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
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function burn(address account, uint256 amount) external override onlyController {
        _burn(account, amount);
    }

    function items() external view override returns (address[] memory) {
        return _strategyItems;
    }

    function percentage(address strategyItem) external view override returns (uint256) {
        return _percentages[strategyItem];
    }

    function nonces(address owner) external view override returns (uint256) {
        return _nonces[owner];
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

    function chainId() public pure returns (uint256 id) {
        assembly {
            id := chainid()
        }
    }

    /**
        @notice Allows tokens to be approved + transfered atomically, if owner has signed the permit hash
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override {
        require(block.timestamp <= deadline, "Strategy.permit: expired deadline");

        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            spender,
                            value,
                            _nonces[owner],
                            deadline
                        )
                    )
                )
            );

        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0) && signer == owner, "Strategy.permit: invalid signature");

        _nonces[owner]++;
        _approve(owner, spender, value);
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
        require(newItems.length == newPercentages.length, "S.vS: invalid input lengths");
        require(newItems[0] != address(0), "S.vS: invalid item addr"); //Everything else will caught be the ordering requirement below
        uint256 total = 0;
        for (uint256 i = 0; i < newItems.length; i++) {
            require(i == 0 || newItems[i] > newItems[i - 1], "S.vS: item ordering");
            require(newPercentages[i] > 0, "S.vS: 0 percentage provided");
            total = total.add(newPercentages[i]);
        }
        require(total == DIVISOR, "S.vS: total percentage wrong");
    }

    /**
     * @notice Set the structure of the strategy
     * @param newItems An array of token addresses that will comprise the strategy
     * @param newPercentages An array of percentages for each token in the above array. Must total 100%
     */
    function _setStructure(
        address[] memory newItems, uint256[] memory newPercentages
    ) internal {
        // Remove old percentages
        for (uint256 i = 0; i < _strategyItems.length; i++) {
            delete _percentages[_strategyItems[i]];
        }
        for (uint256 i = 0; i < newItems.length; i++) {
            _percentages[newItems[i]] = newPercentages[i];
        }
        _strategyItems = newItems;
    }
}
