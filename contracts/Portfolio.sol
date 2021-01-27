//SPDX-License-Identifier: Unlicensed
pragma solidity 0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./interfaces/IOracle.sol";
import "./interfaces/IPortfolio.sol";
import "./interfaces/IPortfolioController.sol";
import "./interfaces/IPortfolioProxyFactory.sol";
import "./interfaces/IWhitelist.sol";
import "./PortfolioToken.sol";
import "./PortfolioOwnable.sol";


contract Portfolio is IPortfolio, PortfolioToken, PortfolioOwnable, Initializable {
    using SafeMath for uint256;
    uint256 private constant DIVISOR = 1000;

    event RebalanceCalled(uint256 total, address caller);
    event NewStructure(address[] tokens, uint256[] percentages);
    event FundsReceived(uint256 amount, address account);

    modifier onlyApproved(address controller) {
        require(IWhitelist(IPortfolioProxyFactory(_factory).whitelist()).approved(controller), "Portfolio.onlyApproved: Controller is not approved");
        require(!_locked, "Portfolio.onlyApproved: Function locked");
        _;
    }

    /*
     * @notice This contract is proxiable. There is no constructor, instead we use the initialize function
     * @params owner_ The address that will own the contract
     * @params name_ The name of this token
     * @params symbol_ The symbol of this token
     * @params tokens_ A list of token addresses that will make up the portfolio
     * @params percentages_ The percentage each token represents of the total portfolio value
     * @params threshold_ The percentage out of balance a token must be before it can be rebalanced
     * @params slippage_ The percentage away from 100% that the total can slip during rebalance due to fees
     * @params timelock_ The amount of time between initializing a restructure and updating the portfolio
     */
    function initialize(
        address factory_,
        address owner_,
        string memory name_,
        string memory symbol_,
        address[] memory routers_,
        address[] memory tokens_,
        uint256[] memory percentages_,
        uint256 threshold_,
        uint256 slippage_,
        uint256 timelock_
    ) external payable initializer returns (bool) {
        _initToken(name_, symbol_);
        _initOwner(owner_);
        // Set globals
        _updateRebalanceThreshold(threshold_);
        _updateSlippage(slippage_);
        _updateTimelock(timelock_);
        _factory = factory_;
        // Set structure
        if (tokens_.length > 0) {
            _verifyStructure(tokens_, percentages_);
            _setStructure(tokens_, percentages_);
        }
        if (msg.value > 0) {
            IPortfolioController(IPortfolioProxyFactory(_factory).controller()).buyTokens{value: msg.value}(_tokens, routers_); // solhint-disable-line
            _mint(owner_, msg.value);
        }
        return true;
    }

    /*
     * @notice Rebalance the portfolio to match the current structure
     * @dev The calldata that gets passed to this function can differ depending on which controller is being used
     * @params data Calldata that gets passed the the controller's rebalance function
     * @params controller The address of the controller that will be doing the handling the trading logic
     */
    function rebalance(
        bytes memory data,
        IPortfolioController controller
    ) external override onlyApproved(address(controller)) {
        require( // Should we include this?
            _social || msg.sender == _owner,
            "Portfolio.rebalance: Rebalance only open on social portfolios"
        );
        (uint256 totalBefore, bool balancedBefore) = _verifyBalance();
        require(!balancedBefore, "Portfolio.rebalance: No point rebalancing a balanced portfolio");
        _locked = true;
        _approveTokens(address(controller), uint256(-1), _tokens);
        _rebalance(totalBefore, data, controller);
        _approveTokens(address(controller), uint256(0), _tokens);
        _locked = false;
    }

    /*
     * @notice Deposit ether, which is traded for the underlying assets, and mint portfolio tokens
     * @params routers An array of addresses for the router that each token will be swap with
     * @params rebalanceData The calldata that is used to rebalance the portfolio before deposit
     * @params controller The address of the controller that will be doing the handling the trading logic
     */
    function deposit(
        address[] memory routers,
        bytes memory rebalanceData,
        IPortfolioController controller
    ) external payable override onlyApproved(address(controller)) {
        require(
            _social || msg.sender == owner(),
            "Portfolio.deposit: Only owner may deposit on non-social profiles"
        );
        require(
            msg.value > 0,
            "Portfolio.deposit: No ether sent with transaction"
        );
        require(
            _tokens.length == routers.length,
            "Portfolio.deposit: Need to pass a router address for each token in the portfolio"
        );
        // TODO: modifier
        _locked = true;
        (uint256 totalBefore, bool balancedBefore) = _verifyBalance();
        // Not sure about passing balance data along with tokens and routers arrays
        if (!balancedBefore) {
            // Could a router not need any calldata for rebalance?
            // require(rebalanceData.length > 0, "Portfolio.deposit: Rebalance data not passed");
            _approveTokens(address(controller), uint256(-1), _tokens);
            totalBefore = _rebalance(totalBefore, rebalanceData, controller);
            _approveTokens(address(controller), uint256(0), _tokens);
        }
        // TODO: can this be done during the rebalance to maximize cases where a rebalance could be accomplished with a deposit?
        controller.buyTokens{value: msg.value}(_tokens, routers); // solhint-disable-line

        // Recheck total
        (uint256 totalAfter, ) = IOracle(oracle()).estimateTotal(address(this), _tokens);
        require(totalAfter >= totalBefore, "Portfolio.deposit: Total value dropped!");
        uint256 valueAdded = totalAfter - totalBefore; // Safe math not needed, already checking for underflow
        uint256 relativeTokens = _totalSupply > 0 ? _totalSupply.mul(valueAdded).div(totalAfter) : totalAfter;
        _mint(msg.sender, relativeTokens);
        _locked = false;
    }

    /*
     * @notice Withdraw the underlying assets and burn the equivalent amount of portfolio token
     * @params amount The amount of portfolio tokens to burn to recover the equivalent underlying assets
     * @params rebalanceData Calldata that gets passed the the controller's rebalance function
     * @params controller The address of the controller that will be doing the handling the trading logic
     */
    function withdraw(
        uint256 amount,
        bytes memory rebalanceData,
        IPortfolioController controller
    ) external override onlyApproved(address(controller)) {
        require(amount > 0, "Error (withdraw): No amount set");
        _locked = true;

        if (rebalanceData.length > 0) {
            (uint256 total, bool balanced) = _verifyBalance();
            if (!balanced) {
                _approveTokens(address(controller), uint256(-1), _tokens);
                _rebalance(total, rebalanceData, controller);
                _approveTokens(address(controller), uint256(0), _tokens);
            }
        }
        _burn(msg.sender, amount);
        uint256 percentage = amount.mul(10**18).div(_totalSupply);
        for (uint256 i = 0; i < _tokens.length; i++) {
            // Should not be possible to have address(0) since the Portfolio will check for it
            IERC20 token = IERC20(_tokens[i]);
            uint256 currentBalance = token.balanceOf(address(this));
            uint256 tokenAmount =
                currentBalance.mul(percentage).div(10**18);
            token.transfer(msg.sender, tokenAmount);
        }
        _locked = false;
    }

    /*
     * @notice Initiate a restructure of the portfolio tokens. This gives users a chance to withdraw before restructure
     * @dev We store the new structure as a bytes32 hash and then check that the
            values are correct when finalizeStructure is called.
     * @params tokens An array of token addresses that will comprise the portfolio
     * @params percentages An array of percentages for each token in the above array. Must total 100%
     */
    function restructure(
        address[] memory tokens,
        uint256[] memory percentages
    ) external override onlyOwner {
        // Verify new structure
        _verifyStructure(tokens, percentages);
        _restructureProof = keccak256(abi.encodePacked(tokens, percentages));
        _restructureTimestamp = block.timestamp;
        emit NewStructure(tokens, percentages);
    }

    /*
     * @notice Finalize a restructure by setting the new values and trading the tokens
     * @dev We confirm that the same structure is sent by checking the bytes32 hash against _restructureProof
     * @params tokens An array of token addresses that will comprise the portfolio
     * @params percentages An array of percentages for each token in the above array. Must total 100%
     * @params sellRouters An array of routers for each sale of the current tokens
     * @params buyRouters An array of routers for each purchase of the new tokens
     * @params controller The address of the controller that will be doing the handling the trading logic
     */
    function finalizeStructure(
        address[] memory tokens,
        uint256[] memory percentages,
        address[] memory sellRouters,
        address[] memory buyRouters,
        IPortfolioController controller
    ) external override {
        require(
            !_social || block.timestamp > _restructureTimestamp.add(_timelock),
            "Portfolio.finalizeStructure: Can only restructure after enough time has passed"
        );
        require(
            keccak256(abi.encodePacked(tokens, percentages)) == _restructureProof,
            "Portfolio.finalizeStructure: Incorrect parameters passed"
        );
        _finalizeStructure(tokens, percentages, sellRouters, buyRouters, controller);
        delete _restructureProof;
        delete _restructureTimestamp;
    }

    /*
     * @notice Setter to change portfolio to social. Cannot be undone.
     * @dev A social profile allows other users to deposit and rebalance the portfolio
     */
    function openPortfolio() external override onlyOwner {
        _social = true;
    }

    /*
     * @notice Setter to update the rebalance threshold
     * @dev The rebalance threshold limits whether a token can be rebalanced. If its current percentage
     *      is within the threshold, it does not get rebalanced.
     * @params threshold The value of the new rebalance threshold
     */
    function updateRebalanceThreshold(uint256 threshold) external override onlyOwner {
        _updateRebalanceThreshold(threshold);
    }

    /*
     * @notice Setter to update the slippage
     * @dev The slippage is minimum percentage the total can drop to during a rebalance.
            If it drops below that value the function reverts.
            e.g. if slippage = 995, it can only drop to 99.5% of the total that was calculate before rebalance
     * @params slippage The value of the new slippage
     */
    function updateSlippage(uint256 slippage) external override onlyOwner {
        _updateSlippage(slippage);
    }

    /*
     * @notice Setter to update the timelock
     * @dev The timelock is the amount of time in seconds that must pass between the
            initial call of restructure() and calling finalizeStructure(). This allows
            users to withdraw their funds if they don't like the new structure
     * @params timelock The value of the new timelock
     */
    function updateTimelock(uint256 timelock) external override onlyOwner {
        _updateTimelock(timelock);
    }

    /*
     * @notice Social bool getter
     * @dev This value determines whether other account may deposit into this portfolio
     */
    function social() external override view returns (bool) {
        return _social;
    }

    /*
     * @notice Rebalance threshold getter
     */
    function rebalanceThreshold() external override view returns (uint256) {
        return _rebalanceThreshold;
    }

    /*
     * @notice Slippage getter
     */
    function slippage() external override view returns (uint256) {
        return _slippage;
    }

    /*
     * @notice Timelock getter
     */
    function timelock() external override view returns (uint256) {
        return _timelock;
    }

    /*
     * @notice Tokens getter
     */
    function getPortfolioTokens() external override view returns (address[] memory) {
        return _tokens;
    }

    /*
     * @notice Get token by index
     * @params index The index of the token in the _tokens array
     */
    function getToken(uint256 index) external override view returns (address) {
        return _tokens[index];
    }

    /*
     * @notice Get token percentage using token address
     * @params tokenAddress The address of the token
     */
    function getTokenPercentage(address tokenAddress) external override view returns (uint256) {
        return _tokenPercentages[tokenAddress];
    }

    /*
     * @notice Oracle address getter
     */
    function oracle() public override view returns (address) {
        return IPortfolioProxyFactory(_factory).oracle();
    }

    // Internal Portfolio Functions
    /*
     * @notice Rebalance the portfolio to match the current structure
     * @dev The calldata that gets passed to this function can differ depending on which controller is being used
     * @params totalBefore The valuation of the portfolio before rebalance
     * @params data Calldata that gets passed the the controller's rebalance function
     * @params controller The address of the controller that will be doing the handling the trading logic
     */
    function _rebalance(
        uint256 totalBefore,
        bytes memory data,
        IPortfolioController controller
    ) internal returns (uint256) {
        controller.rebalance(data);
        // Recheck total
        (uint256 totalAfter, bool balancedAfter) = _verifyBalance();
        require(balancedAfter, "Portfolio.rebalance: You had one job and you fucked it up"); //Too judgemental?
        require(
            totalAfter >= totalBefore.mul(_slippage).div(DIVISOR),
            "Portfolio.rebalance: Total value slipped too much!"
        );
        emit RebalanceCalled(totalAfter, msg.sender);
        return totalAfter;
    }

    /*
     * @notice Internal setter to update the rebalance threshold
     * @dev The rebalance threshold limits whether a token can be rebalanced. If its current percentage
     *      is within the threshold, it does not get rebalanced.
     * @params threshold_ The value of the new rebalance threshold
     */
    function _updateRebalanceThreshold(uint256 threshold_) internal {
        require(
            threshold_ < DIVISOR,
            "Portfolio.updateRebalanceThreshold: Threshold cannot be 100% or greater"
        );
        _rebalanceThreshold = threshold_;
    }

    /*
     * @notice Internal setter to update the slippage
     * @dev The slippage is minimum percentage the total can drop to during a rebalance.
            If it drops below that value the function reverts.
            e.g. if slippage = 995, it can only drop to 99.5% of the total that was calculate before rebalance
     * @params slippage_ The value of the new slippage
     */
    function _updateSlippage(uint256 slippage_) internal {
        require(
            slippage_ <= DIVISOR,
            "Portfolio.updateSlippage: Slippage cannot be greater than 100%"
        );
        _slippage = slippage_;
    }

    /*
     * @notice Internal setter to update the timelock
     * @dev The timelock is the amount of time in seconds that must pass between the
            initial call of restructure() and calling finalizeStructure(). This allows
            users to withdraw their funds if they don't like the new structure
     * @params timelock_ The value of the new timelock
     */
    function _updateTimelock(uint256 timelock_) internal {
        _timelock = timelock_;
    }

    /*
     * @notice This function gets the portfolio value from the oracle and checks
     *         whether the portfolio is balanced. Necessary to confirm the balance
     *         before and after a rebalance to ensure nothing fishy happened
     */
    function _verifyBalance() internal view returns (uint256, bool) {
        (uint256 total, uint256[] memory estimates) = IOracle(oracle()).estimateTotal(address(this), _tokens);
        bool balanced = true;
        for (uint256 i = 0; i < _tokens.length; i++) {
            uint256 expectedValue = total.mul(_tokenPercentages[_tokens[i]]).div(DIVISOR);
            uint256 rebalanceRange = expectedValue.mul(_rebalanceThreshold).div(DIVISOR);
            if (estimates[i] > expectedValue.add(rebalanceRange)) {
                balanced = false;
                break;
            }
            if (estimates[i] < expectedValue.sub(rebalanceRange)) {
                balanced = false;
                break;
            }
        }
        return (total, balanced);
    }

    /*
     * @notice This function verifies that the structure passed in parameters is valid
     * @dev We check that the array lengths match, that the percentages add 100%,
     *      no zero addresses, and no duplicates
     */
     // TODO: check for 0 percentage?
    function _verifyStructure(
        address[] memory tokens,
        uint256[] memory percentages
    ) internal pure returns (bool) {
        require(
            tokens.length == percentages.length,
            "Portfolio._verifyAndSetStructure: Different array lengths"
        );
        uint256 total = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            require(
                tokens[i] != address(0),
                "Portfolio._verifyAndSetStructure: No zero address, please use WETH address"
            );
            require(
                i == 0 ||
                tokens[i] > tokens[i-1],
                "Portfolio._verifyAndSetStructure: Duplicate token address or addresses out of order"
            );
            total = total.add(percentages[i]);
        }
        require(
            total == DIVISOR,
            "Portfolio._verifyAndSetStructure: Percentages do not add up to 100%"
        );
    }

    /*
     * @notice Set the structure of the portfolio
     * @params tokens An array of token addresses that will comprise the portfolio
     * @params percentages An array of percentages for each token in the above array. Must total 100%
     */
    function _setStructure(address[] memory tokens, uint256[] memory percentages) internal {
        for (uint256 i = 0; i < tokens.length; i++) {
            _tokenPercentages[tokens[i]] = percentages[i];
        }
        _tokens = tokens;
    }

    /*
     * @notice Finalize the structure by selling current posiition, setting new structure, and buying new position
     * @params tokens An array of token addresses that will comprise the portfolio
     * @params percentages An array of percentages for each token in the above array. Must total 100%
     * @params sellRouters An array of routers for each sale of the current tokens
     * @params buyRouters An array of routers for each purchase of the new tokens
     * @params controller The address of the controller that will be doing the handling the trading logic
     */
    function _finalizeStructure(
        address[] memory tokens,
        uint256[] memory percentages,
        address[] memory sellRouters,
        address[] memory buyRouters,
        IPortfolioController controller //solhint-disable-line
    ) internal {
        require(sellRouters.length == _tokens.length, "Portfolio._finalizeStructure: Sell routers length mismatch");
        require(buyRouters.length == tokens.length, "Portfolio._finalizeStructure: Buy routers length mismatch");
        _approveTokens(address(controller), uint256(-1), _tokens);
        // Reset all values and return tokens to ETH
        controller.sellTokens(_tokens, sellRouters);
        // Remove percentages
        for (uint256 i = 0; i < _tokens.length; i++) {
            delete _tokenPercentages[_tokens[i]];
        }
        _approveTokens(address(controller), uint256(0), _tokens);
        // Set new structure
        _setStructure(tokens, percentages);
        // Since tokens have already been minted we don't do router.deposit, instead use router.convert
        controller.buyTokens{value: address(this).balance}(_tokens, buyRouters); //solhint-disable-line
    }

    /*
     * @notice Batch approve tokens
     * @params spender The address that will be approved to spend tokens
     * @params amount The amount the each token will be approved for
     * @params tokens An array of tokens that will be approved
     */
    function _approveTokens(address spender, uint256 amount, address[] memory tokens) internal {
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).approve(spender, amount);
        }
        address weth = IOracle(oracle()).weth();
        if (_tokenPercentages[weth] == 0) {
            //Approving is still needed as we need to transfer weth for rebalancing
            IERC20(weth).approve(spender, amount);
        }
    }

    /*
     * @notice Receive ether sent to this address
     * @dev We must allow this contract to receive funds for when tokens get sold
     */
    receive() external payable {
        emit FundsReceived(msg.value, msg.sender);
    }
}
