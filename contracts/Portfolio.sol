//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./PortfolioToken.sol";
import "./interfaces/IPortfolio.sol";
import "./interfaces/IPortfolioProxyFactory.sol";
import "./interfaces/IWhitelist.sol";

contract Portfolio is IPortfolio, PortfolioToken, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant DIVISOR = 1000;

    // Initialize constructor to disable implementation
    constructor() public initializer {}

    /**
     * @dev Throws if called by any account other than the controller.
     */
    modifier onlyController() {
        require(_controller == msg.sender, "P.oC: controller only");
        _;
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 version_,
        address controller_,
        address manager_,
        address[] memory tokens_,
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
        if (tokens_.length > 0) {
            verifyStructure(tokens_, percentages_);
            _setStructure(tokens_, percentages_);
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
        for (uint256 i = 0; i < _tokens.length; i++) {
            IERC20(_tokens[i]).safeApprove(account, amount);
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
     * @notice Set the structure of the portfolio
     * @param newTokens An array of token addresses that will comprise the portfolio
     * @param newPercentages An array of percentages for each token in the above array. Must total 100%
     */
    function setStructure(address[] memory newTokens, uint256[] memory newPercentages)
        external
        override
        onlyController
    {
        _setStructure(newTokens, newPercentages);
    }

    /**
     * @notice Withdraw the underlying assets and burn the equivalent amount of portfolio token
     * @param amount The amount of portfolio tokens to burn to recover the equivalent underlying assets
     */
    function withdraw(uint256 amount) external override {
        require(amount > 0, "P.withdraw: 0 amount");
        uint256 percentage = amount.mul(10**18).div(_totalSupply);
        _burn(msg.sender, amount);
        for (uint256 i = 0; i < _tokens.length; i++) {
            // Should not be possible to have address(0) since the Portfolio will check for it
            IERC20 token = IERC20(_tokens[i]);
            uint256 currentBalance = token.balanceOf(address(this));
            uint256 tokenAmount = currentBalance.mul(percentage).div(10**18);
            token.safeTransfer(msg.sender, tokenAmount);
        }
    }

    function updateManager(address newManager) external override {
        require(msg.sender == _manager, "P.uM: Not manager");
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

    function tokens() external view override returns (address[] memory) {
        return _tokens;
    }

    function tokenPercentage(address token) external view override returns (uint256) {
        return _tokenPercentages[token];
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
        return IPortfolioProxyFactory(_factory).oracle();
    }

    function whitelist() public view override returns (address) {
        return IPortfolioProxyFactory(_factory).whitelist();
    }

    function chainId() public pure returns (uint256 id) {
        assembly {
            id := chainid()
        }
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override {
        require(block.timestamp <= deadline, "Portfolio.permit: expired deadline");

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
        require(signer != address(0) && signer == owner, "Portfolio.permit: invalid signature");

        _nonces[owner]++;
        _approve(owner, spender, value);
    }

    /**
     * @notice This function verifies that the structure passed in parameters is valid
     * @dev We check that the array lengths match, that the percentages add 100%,
     *      no zero addresses, and no duplicates
     * @dev Token addresses must be passed in, according to increasing byte value
     */
    function verifyStructure(address[] memory newTokens, uint256[] memory newPercentages)
        public
        pure
        override
        returns (bool)
    {
        require(newTokens.length == newPercentages.length, "P.vS: invalid input lengths");
        require(newTokens[0] != address(0), "P.vS: invalid weth addr"); //Everything else will caught be the ordering requirement below
        uint256 total = 0;
        for (uint256 i = 0; i < newTokens.length; i++) {
            require(i == 0 || newTokens[i] > newTokens[i - 1], "P.vS: token ordering");
            require(newPercentages[i] > 0, "P.vS: bad percentage");
            total = total.add(newPercentages[i]);
        }
        require(total == DIVISOR, "P.vS: total percentage wrong");
    }

    /**
     * @notice Set the structure of the portfolio
     * @param newTokens An array of token addresses that will comprise the portfolio
     * @param newPercentages An array of percentages for each token in the above array. Must total 100%
     */
    function _setStructure(address[] memory newTokens, uint256[] memory newPercentages) internal {
        // Remove old percentages
        for (uint256 i = 0; i < _tokens.length; i++) {
            delete _tokenPercentages[_tokens[i]];
        }
        for (uint256 i = 0; i < newTokens.length; i++) {
            _tokenPercentages[newTokens[i]] = newPercentages[i];
        }
        _tokens = newTokens;
    }
}
