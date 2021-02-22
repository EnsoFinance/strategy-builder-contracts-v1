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

    // Initialize constructor to disable implementation
    constructor() public initializer {} // solhint-disable-line

    /**
     * @dev Throws if called by any account other than the controller.
     */
    modifier onlyController() {
        require(_controller == msg.sender, "PortfolioToken.onlyController: caller is not the controller");
        _;
    }

    function initialize(
        string memory name_, string memory symbol_, uint256 version_, address controller_, address manager_
    ) external initializer returns (bool) {
        _controller = controller_;
        _manager = manager_;
        _factory = msg.sender;
        _name = name_;
        _symbol = symbol_;
        _decimals = 18;
        // keccak256("Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)");
        PERMIT_TYPEHASH = 0xea2aa0a1be11a07ed86d755c93467f4f82362b452371d1ba94d1715123511acb;
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,uint256 version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name_)),
            version_,
            chainId(),
            address(this)
        ));
    }

    function approveToken(IERC20 token, address account, uint256 amount) external override onlyController {
        token.safeApprove(account, amount);
    }

    function approveTokens(address account, uint256 amount) external override onlyController {
        for (uint256 i = 0; i < _tokens.length; i++) {
            IERC20(_tokens[i]).safeApprove(account, amount);
        }
    }

    function transferToken(IERC20 token, address account, uint256 amount) external override onlyController {
        token.safeTransfer(account, amount);
    }

    /**
     * @notice Set the structure of the portfolio
     * @param newTokens An array of token addresses that will comprise the portfolio
     * @param newPercentages An array of percentages for each token in the above array. Must total 100%
     */
    function setStructure(
        address[] memory newTokens, uint256[] memory newPercentages
    ) external override onlyController {
        // Remove old percentages
        for (uint256 i = 0; i < _tokens.length; i++) {
            delete _tokenPercentages[_tokens[i]];
        }
        for (uint256 i = 0; i < newTokens.length; i++) {
            _tokenPercentages[newTokens[i]] = newPercentages[i];
        }
        _tokens = newTokens;
    }

    /**
     * @notice Withdraw the underlying assets and burn the equivalent amount of portfolio token
     * @param amount The amount of portfolio tokens to burn to recover the equivalent underlying assets
     */
    function withdraw(
        uint256 amount
    ) external override {
        require(amount > 0, "Error (withdraw): No amount set");
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
        require(msg.sender == _manager, "Portfolio.updateManager: Not manager");
        _manager = newManager;
    }

    // Approve with signature
    function permit(
        address holder,
        address spender,
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        bytes32 digest =
            keccak256(abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(
                    PERMIT_TYPEHASH,
                    holder,
                    spender,
                    nonce,
                    expiry,
                    allowed))
        ));

        require(holder != address(0), "PortfolioToken.permit: No null address");
        require(holder == ecrecover(digest, v, r, s), "PortfolioToken.permit: Invalid permit");
        require(expiry == 0 || block.timestamp <= expiry, "PortfolioToken.permit: Expired");
        require(nonce == _nonces[holder]++, "PortfolioToken.permit: Invalid nonce");
        uint256 amount = allowed ? uint256(-1) : 0;
        _approve(holder, spender, amount);
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
        assembly { id := chainid() }
    }
}
