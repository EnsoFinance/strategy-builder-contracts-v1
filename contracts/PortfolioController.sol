//SPDX-License-Identifier: Unlicensed
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IWETH.sol";
import "./interfaces/IPortfolioController.sol";
import "./interfaces/IOracle.sol";
import "./PortfolioControllerStorage.sol";

/**
 * @notice This contract holds tokens in proportion to their weth value as reported by IOracle and mints/burns portfolio tokens to represent the underlying assets.
 * @dev Whitelisted routers are able to execute different swapping strategies as long as total portfolio value doesn't drop below the defined slippage amount
 * @dev To avoid someone from repeatedly skimming off this slippage value, threshold should be set sufficiently high
 */
contract PortfolioController is IPortfolioController, PortfolioControllerStorage {
    using SafeMath for uint256;

    uint256 private constant DIVISOR = 1000;

    event RebalanceCalled(address indexed portfolio, uint256 total, address caller);
    event Deposit(address indexed portfolio, uint256 value, uint256 amount);
    event Withdraw(address indexed portfolio, uint256 amount, uint256[] amounts);
    event NewStructure(address indexed portfolio, address[] tokens, uint256[] percentages);
    event NewValue(address indexed portfolio, TimelockCategory category, uint256 newValue);

    /*
     * @param creator_ The address that created the portfolio
     * @param portfolio_ The address of the portfolio
     * @param adapters_ A list of exchange adapters
     * @param tokens_ A list of token addresses that will make up the portfolio
     * @param percentages_ The percentage each token represents of the total portfolio value
     * @param threshold_ The percentage out of balance a token must be before it can be rebalanced
     * @param slippage_ The percentage away from 100% that the total can slip during rebalance due to fees
     * @param timelock_ The amount of time between initializing a restructure and updating the portfolio
     */
    function setupPortfolio(
        address creator_,
        address portfolio_,
        bool social_,
        uint256 fee_,
        uint256 threshold_,
        uint256 slippage_,
        uint256 timelock_,
        address router_,
        bytes memory data_
    ) external payable override {
        _setLock();
        require(_initialized[portfolio_] == false, "PC.sP: already setup");
        require(threshold_ <= DIVISOR && slippage_ <= DIVISOR, "PC.sP: slippage/threshold high");
        _initialized[portfolio_] = true;
        // Set globals
        PortfolioState storage portfolioState = _portfolioStates[portfolio_];
        portfolioState.rebalanceThreshold = threshold_;
        portfolioState.slippage = slippage_;
        portfolioState.timelock = timelock_;
        IPortfolio portfolio = IPortfolio(portfolio_);
        if (msg.value > 0) {
            address weth = IOracle(portfolio.oracle()).weth();
            IWETH(weth).deposit{value: msg.value}();
            IERC20(weth).approve(router_, msg.value);
            IPortfolioRouter(router_).deposit(portfolio_, data_);
            IERC20(weth).approve(router_, 0);
            portfolio.mint(creator_, msg.value);

        }
        if (social_) {
            _openPortfolio(IPortfolio(portfolio_), fee_);
        }
        _removeLock();
    }

    /**
     * @notice Rebalance the portfolio to match the current structure
     * @dev The calldata that gets passed to this function can differ depending on which router is being used
     * @param router The address of the router that will be doing the handling the trading logic
     * @param data Calldata that gets passed the the router's rebalance function
     */
    function rebalance(
        IPortfolio portfolio,
        IPortfolioRouter router,
        bytes memory data
    ) external override {
        _setLock();
        _onlyApproved(portfolio, address(router));
        _onlyManager(portfolio);
        (uint256 totalBefore, bool balancedBefore) = _verifyBalance(portfolio);
        require(!balancedBefore, "PC.rebalance: balanced");
        _approveTokens(portfolio, address(router), uint256(-1));
        _rebalance(portfolio, router, totalBefore, data);
        _approveTokens(portfolio, address(router), uint256(0));
        _removeLock();
    }

    /**
     * @notice Deposit ether, which is traded for the underlying assets, and mint portfolio tokens
     * @param portfolio The portfolio being deposited to
     * @param router The address of the router that will be doing the handling the trading logic
     * @param data The calldata for the router's deposit function
     */
    function deposit(
        IPortfolio portfolio,
        IPortfolioRouter router,
        bytes memory data
    ) external payable override {
        _setLock();
        _onlyApproved(portfolio, address(router));
        _socialOrManager(portfolio);
        require(msg.value > 0, "PC.deposit: No ether sent");
        (uint256 totalBefore, ) =
            IOracle(portfolio.oracle()).estimateTotal(address(portfolio), portfolio.tokens());

        address weth = IOracle(portfolio.oracle()).weth();
        IWETH(weth).deposit{value: msg.value}();
        IERC20(weth).approve(address(router), msg.value);
        router.deposit(address(portfolio), data);
        IERC20(weth).approve(address(router), 0);

        // Recheck total
        (uint256 totalAfter, ) =
            IOracle(portfolio.oracle()).estimateTotal(address(portfolio), portfolio.tokens());
        require(totalAfter > totalBefore, "PC.deposit: Lost value");
        uint256 valueAdded = totalAfter - totalBefore; // Safe math not needed, already checking for underflow
        uint256 totalSupply = portfolio.totalSupply();
        uint256 relativeTokens =
            totalSupply > 0 ? totalSupply.mul(valueAdded).div(totalAfter) : totalAfter;
        portfolio.mint(msg.sender, relativeTokens);
        emit Deposit(address(portfolio), msg.value, relativeTokens);
        _removeLock();
    }

    /**
     * @notice Withdraw the underlying assets and burn the equivalent amount of portfolio token
     * @param portfolio The portfolio that will be withdrawn from
     * @param amount The amount of portfolio tokens to burn to recover the equivalent underlying assets
     */
    function withdrawAssets(IPortfolio portfolio, uint256 amount) external override {
        _setLock();
        require(amount > 0, "PC.withdraw: No amount");
        uint256 percentage = amount.mul(10**18).div(portfolio.totalSupply());
        portfolio.burn(msg.sender, amount);
        address[] memory tokens = portfolio.tokens();
        uint256[] memory amounts = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            // Should not be possible to have address(0) since the Portfolio will check for it
            IERC20 token = IERC20(tokens[i]);
            uint256 currentBalance = token.balanceOf(address(portfolio));
            uint256 tokenAmount = currentBalance.mul(percentage).div(10**18);
            portfolio.transferToken(token, msg.sender, tokenAmount);
            amounts[i] = tokenAmount;
        }
        emit Withdraw(address(portfolio), amount, amounts);
        _removeLock();
    }

    function withdrawPerformanceFee(IPortfolio portfolio) external override {
        _setLock();
        _onlyManager(portfolio);
        (uint256 total, ) =
            IOracle(portfolio.oracle()).estimateTotal(address(portfolio), portfolio.tokens());
        uint256 totalSupply = portfolio.totalSupply();
        uint256 tokenValue = total.mul(10**18).div(totalSupply);
        require(tokenValue > _lastTokenValues[address(portfolio)], "PC.wPF: No earnings");
        uint256 diff = tokenValue.sub(_lastTokenValues[address(portfolio)]);
        uint256 performanceFee = _portfolioStates[address(portfolio)].performanceFee;
        uint256 reward = totalSupply.mul(diff).mul(performanceFee).div(DIVISOR).div(10**18);
        _lastTokenValues[address(portfolio)] = tokenValue;
        portfolio.mint(msg.sender, reward); // _onlyManager() ensures that msg.sender == manager
        _removeLock();
    }

    /**
     * @notice Initiate a restructure of the portfolio tokens. This gives users a chance to withdraw before restructure
     * @dev We store the new structure as a bytes32 hash and then check that the
            values are correct when finalizeStructure is called.
     * @param tokens An array of token addresses that will comprise the portfolio
     * @param percentages An array of percentages for each token in the above array. Must total 100%
     */
    function restructure(
        IPortfolio portfolio,
        address[] memory tokens,
        uint256[] memory percentages
    ) external override {
        _setLock();
        _onlyManager(portfolio);
        Timelock storage timelock = _timelocks[address(portfolio)];
        require(
            timelock.timestamp == 0 ||
                block.timestamp >
                timelock.timestamp.add(_portfolioStates[address(portfolio)].timelock),
            "PC.restructure: Timelock active"
        );
        portfolio.verifyStructure(tokens, percentages);
        timelock.category = TimelockCategory.RESTRUCTURE;
        timelock.timestamp = block.timestamp;
        timelock.data = abi.encode(tokens, percentages);

        emit NewStructure(address(portfolio), tokens, percentages);
        _removeLock();
    }

    /**
     * @notice Finalize a restructure by setting the new values and trading the tokens
     * @dev We confirm that the same structure is sent by checking the bytes32 hash against _restructureProof
     * @param sellAdapters An array of adapters for each sale of the current tokens
     * @param buyAdapters An array of adapters for each purchase of the new tokens
     * @param router The address of the router that will be doing the handling the trading logic
     */
    function finalizeStructure(
        IPortfolio portfolio,
        address router,
        address[] memory sellAdapters,
        address[] memory buyAdapters
    ) external override {
        _setLock();
        PortfolioState storage portfolioState = _portfolioStates[address(portfolio)];
        Timelock storage timelock = _timelocks[address(portfolio)];
        require(
            !portfolioState.social ||
                block.timestamp > timelock.timestamp.add(portfolioState.timelock),
            "PC.fS: Timelock active"
        );
        require(timelock.category == TimelockCategory.RESTRUCTURE, "PC.fS: Wrong category");
        (address[] memory tokens, uint256[] memory percentages) =
            abi.decode(timelock.data, (address[], uint256[]));
        _finalizeStructure(portfolio, router, tokens, percentages, sellAdapters, buyAdapters);
        delete timelock.category;
        delete timelock.timestamp;
        delete timelock.data;
        _removeLock();
    }

    function updateValue(
        IPortfolio portfolio,
        uint256 categoryIndex,
        uint256 newValue
    ) external override {
        _setLock();
        _onlyManager(portfolio);
        Timelock storage timelock = _timelocks[address(portfolio)];
        require(
            timelock.timestamp == 0 ||
                block.timestamp >
                timelock.timestamp.add(_portfolioStates[address(portfolio)].timelock),
            "PC.uV: Timelock active"
        );
        TimelockCategory category = TimelockCategory(categoryIndex);
        require(category != TimelockCategory.RESTRUCTURE);
        if (category != TimelockCategory.TIMELOCK)
            require(newValue <= DIVISOR, "PC.uV: Value too high");

        timelock.category = category;
        timelock.timestamp = block.timestamp;
        timelock.data = abi.encode(newValue);
        emit NewValue(address(portfolio), category, newValue);
        _removeLock();
    }

    function finalizeValue(address portfolio) external override {
        _setLock();
        PortfolioState storage portfolioState = _portfolioStates[portfolio];
        Timelock storage timelock = _timelocks[portfolio];
        require(timelock.category != TimelockCategory.RESTRUCTURE, "PC.fV: Wrong category");
        require(
            !portfolioState.social ||
                block.timestamp > timelock.timestamp.add(portfolioState.timelock),
            "PC.fV: Timelock active"
        );
        uint256 newValue = abi.decode(timelock.data, (uint256));
        if (timelock.category == TimelockCategory.THRESHOLD) {
            portfolioState.rebalanceThreshold = newValue;
        } else if (timelock.category == TimelockCategory.SLIPPAGE) {
            portfolioState.slippage = newValue;
        } else { //Only possible option is TimelockCategory.TIMELOCK
            portfolioState.timelock = newValue;
        }
        delete timelock.category;
        delete timelock.timestamp;
        delete timelock.data;
        _removeLock();
    }

    /**
     * @notice Setter to change portfolio to social. Cannot be undone.
     * @dev A social profile allows other users to deposit and rebalance the portfolio
     */
    function openPortfolio(IPortfolio portfolio, uint256 fee) external override {
        _setLock();
        _onlyManager(portfolio);
        _openPortfolio(portfolio, fee);
        _removeLock();
    }

    /**
     * @notice Social bool getter
     * @dev This value determines whether other account may deposit into this portfolio
     */
    function social(address portfolio) external view override returns (bool) {
        return _portfolioStates[portfolio].social;
    }

    /**
     * @notice Rebalance threshold getter
     */
    function rebalanceThreshold(address portfolio) external view override returns (uint256) {
        return _portfolioStates[portfolio].rebalanceThreshold;
    }

    /**
     * @notice Slippage getter
     */
    function slippage(address portfolio) external view override returns (uint256) {
        return _portfolioStates[portfolio].slippage;
    }

    /**
     * @notice Timelock getter
     */
    function timelock(address portfolio) external view override returns (uint256) {
        return _portfolioStates[portfolio].timelock;
    }

    // Internal Portfolio Functions
    /**
     * @notice Rebalance the portfolio to match the current structure
     * @dev The calldata that gets passed to this function can differ depending on which router is being used
     * @param totalBefore The valuation of the portfolio before rebalance
     * @param data Calldata that gets passed the the router's rebalance function
     * @param router The address of the router that will be doing the handling the trading logic
     */
    function _rebalance(
        IPortfolio portfolio,
        IPortfolioRouter router,
        uint256 totalBefore,
        bytes memory data
    ) internal returns (uint256) {
        router.rebalance(address(portfolio), data);
        // Recheck total
        (uint256 totalAfter, bool balancedAfter) = _verifyBalance(portfolio);
        require(balancedAfter, "PC._rebalance: not balanced");
        require(
            totalAfter >=
                totalBefore.mul(_portfolioStates[address(portfolio)].slippage).div(DIVISOR),
            "PC._rebalance: value slipped!"
        );
        emit RebalanceCalled(address(portfolio), totalAfter, msg.sender);
        return totalAfter;
    }

    function _openPortfolio(IPortfolio portfolio, uint256 fee) internal {
        require(fee < DIVISOR, "PC._oP: Fee too high");
        (uint256 total, ) =
            IOracle(portfolio.oracle()).estimateTotal(address(portfolio), portfolio.tokens());
        //As token value increase compared to the _tokenValueLast value, performance fees may be extracted
        _lastTokenValues[address(portfolio)] = total.mul(10**18).div(portfolio.totalSupply());
        PortfolioState storage portfolioState = _portfolioStates[address(portfolio)];
        portfolioState.performanceFee = fee;
        portfolioState.social = true;
    }

    /**
     * @notice This function gets the portfolio value from the oracle and checks
     *         whether the portfolio is balanced. Necessary to confirm the balance
     *         before and after a rebalance to ensure nothing fishy happened
     */
    function _verifyBalance(IPortfolio portfolio) internal view returns (uint256, bool) {
        address[] memory tokens = portfolio.tokens();
        (uint256 total, uint256[] memory estimates) =
            IOracle(portfolio.oracle()).estimateTotal(address(portfolio), tokens);
        bool balanced = true;
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 expectedValue = total.mul(portfolio.tokenPercentage(tokens[i])).div(DIVISOR);
            uint256 rebalanceRange =
                expectedValue.mul(_portfolioStates[address(portfolio)].rebalanceThreshold).div(
                    DIVISOR
                );
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

    /**
     * @notice Finalize the structure by selling current posiition, setting new structure, and buying new position
     * @param tokens An array of token addresses that will comprise the portfolio
     * @param percentages An array of percentages for each token in the above array. Must total 100%
     * @param sellAdapters An array of adapters for each sale of the current tokens
     * @param buyAdapters An array of adapters for each purchase of the new tokens
     * @param router The address of the router that will be doing the handling the trading logic
     */
    function _finalizeStructure(
        IPortfolio portfolio,
        address router,
        address[] memory tokens,
        uint256[] memory percentages,
        address[] memory sellAdapters,
        address[] memory buyAdapters
    ) internal {
        address[] memory oldTokens = portfolio.tokens();
        require(sellAdapters.length == oldTokens.length, "PC._fS: Sell adapters length");
        require(buyAdapters.length == tokens.length, "PC._fS: Buy adapters length");
        _approveTokens(portfolio, router, uint256(-1));
        // Reset all values and return tokens to ETH
        IPortfolioRouter(router).sellTokens(address(portfolio), oldTokens, sellAdapters);
        _approveTokens(portfolio, router, uint256(0));
        // Set new structure
        portfolio.setStructure(tokens, percentages);
        // Since tokens have already been minted we don"t do router.deposit, instead use router.convert
        IERC20 weth = IERC20(IOracle(portfolio.oracle()).weth());
        weth.approve(router, uint256(-1));
        IPortfolioRouter(router).buyTokens(address(portfolio), tokens, buyAdapters);
        weth.approve(router, 0);
    }

    /**
     * @notice Batch approve tokens
     * @param spender The address that will be approved to spend tokens
     * @param amount The amount the each token will be approved for
     */
    function _approveTokens(
        IPortfolio portfolio,
        address spender,
        uint256 amount
    ) internal {
        portfolio.approveTokens(spender, amount);
        address weth = IOracle(portfolio.oracle()).weth();
        if (portfolio.tokenPercentage(weth) == 0) {
            //Approving is still needed as we need to transfer weth for rebalancing
            portfolio.approveToken(IERC20(weth), spender, amount);
        }
    }

    /**
     * @notice Checks that router is whitelisted
     */
    function _onlyApproved(IPortfolio portfolio, address router) internal view {
        require(portfolio.isWhitelisted(router), "PC._oA: Router not approved");
    }

    function _onlyManager(IPortfolio portfolio) internal view {
        require(msg.sender == portfolio.manager(), "PC._oM: Not manager");
    }

    /**
     * @notice Checks if portfolio is social or else require msg.sender is manager
     */
    function _socialOrManager(IPortfolio portfolio) internal view {
        require(
            msg.sender == portfolio.manager() || _portfolioStates[address(portfolio)].social,
            "PC._sOM: Not manager"
        );
    }

    /**
     * @notice Sets Reentrancy guard
     */
    function _setLock() internal {
        require(!_locked, "PC._sL: No Reentrancy");
        _locked = true;
    }

    /**
     * @notice Removes reentrancy guard.
     */
    function _removeLock() internal {
        _locked = false;
    }
}
