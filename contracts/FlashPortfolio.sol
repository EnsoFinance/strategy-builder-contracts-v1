// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Balances} from "./libraries/Balances.sol";
import {GenericController} from "./controllers/GenericController.sol";
import {ReentrancyGuard} from "./helpers/ReentrancyGuard.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Multicall} from "./helpers/Multicall.sol";
import "hardhat/console.sol";
contract FlashPortfolio is ReentrancyGuard, ERC20{
    using console for *;
    using Balances for Balances.Snapshot;

    // Accepted value lost during deposit/withdrawl/rebalance
    uint256 public immutable SLIPPAGE_TOLERANCE = 20;  // 20/1000 = 2% TODO: oracle (requires balance to know price)

    // Portfolio tokens and tokens desired percentage value of total portfolio ()
    address[] public tokens;
    uint256[] public tokenPercentages;

    address public priceOracle;

    // Initialize token allocations
    constructor(
        address[] memory portfolioTokens,
        uint256[] memory portfolioTokenPercentages,
        address oracle
    ) public ERC20("FlashPortfolio", "FLASH") {
        // TODO: enumerable set + checks
        // TODO: validate percentages
        tokens = portfolioTokens;
        tokenPercentages = portfolioTokenPercentages;
        priceOracle = oracle;
    }

    // Approve tokens to rebalancer/trader, and let them make trades.
    // Can use this to deposit/withdraw/rebalance
    // Rebalancer/trader gets minted/burned portfolio tokens depending on the valuation change
    // TODO: pass in index to portfolio tokens (no untrusted address inputs allowed)
    function rebalance(
        address[] memory tokensRequested,
        uint256[] memory amountsRequested,
        address receiver,
        Multicall.Call[] memory calls
    ) external lock noApprovals(tokensRequested, receiver) {
        // Optimistically approve tokens for caller to take 
        for (uint256 i = 0; i < tokensRequested.length; i++) {
            require(
                ERC20(tokensRequested[i]).approve(
                    receiver,
                    amountsRequested[i]
                ),
                "Failed to approve portfolio tokens"
            );
        }

        // Get token balances before external call
        Balances.Snapshot memory preValue = Balances.snapshot(tokens, priceOracle);

        // Let external contract to make trades/transfers
        bytes memory callBytes = abi.encode(calls);
        require(
            GenericController(receiver).rebalance(callBytes),
            "Rebalancer didnt return true"
        );

        // Get post-call value
        Balances.Snapshot memory postValue = Balances.snapshot(tokens, priceOracle);

        // Burn/Mint LP tokens
        settlePortfolioTokens(receiver, preValue, postValue);

        uint256 preImbalance = preValue.getTotalImbalance(tokenPercentages);
        uint256 postImbalance = postValue.getTotalImbalance(tokenPercentages);
        // Is the relative imbalance greater than before?
        require(
            preValue.relativeImbalance(preImbalance).add(SLIPPAGE_TOLERANCE) >=
                postValue.relativeImbalance(postImbalance),
            "Imbalance caused"
        );
    }

    // TODO: check for price variation after external calls?
    // TODO: fix calculation
    function settlePortfolioTokens(
        address sender,
        Balances.Snapshot memory preValue,
        Balances.Snapshot memory postValue
    ) internal {
        // withdrawl
        if (preValue.totalValue > postValue.totalValue) {
            uint256 valueDiff = preValue.totalValue - postValue.totalValue;
            uint256 percentage = valueDiff.mul(1000).div(totalSupply());
            uint256 lpTokenAmount = percentage.mul(totalSupply()).div(1000);
            return _burn(sender, lpTokenAmount);
        }
        // deposit
        if (preValue.totalValue < postValue.totalValue) {
            uint256 valueDiff = postValue.totalValue - preValue.totalValue;
            if (totalSupply() == 0) {
                return _mint(sender, valueDiff.mul(1000));
            }
            uint256 percentage = valueDiff.mul(1000).div(totalSupply());
            uint256 lpTokenAmount = percentage.mul(totalSupply()).div(1000);
            return _mint(sender, lpTokenAmount);
        }
    }

    // TODO: use wrapper for getter functions
    function getTokenPercentages()
        public
        view
        returns (uint256[] memory percentages)
    {
        percentages = tokenPercentages;
    }

    function getTotalImbalance() public view returns (uint256 imbalance) {
        Balances.Snapshot memory portfolioValue = Balances.snapshot(
            tokens,
            priceOracle
        );
        imbalance = portfolioValue.getTotalImbalance(tokenPercentages);
    }

    function getTokenImbalances()
        public
        view
        returns (uint256[] memory values)
    {
        Balances.Snapshot memory portfolioValue = Balances.snapshot(
            tokens,
            priceOracle
        );
        uint256[] memory difference = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            difference[i] = portfolioValue.getTokenImbalance(
                i,
                tokenPercentages[i]
            );
        }
        values = difference;
    }

    function tokenValues() public view returns (uint256[] memory values) {
        Balances.Snapshot memory portfolioValue = Balances.snapshot(
            tokens,
            priceOracle
        );
        uint256[] memory tValues = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            tValues[i] = portfolioValue.tokenValue(i);
        }
        values = tValues;
    }

    function tokenValue(uint256 index) public view returns (uint256 value) {
        Balances.Snapshot memory portfolioValue = Balances.snapshot(
            tokens,
            priceOracle
        );
        value = portfolioValue.tokenValue(index);
    }

    function totalValue() public view returns (uint256 value) {
        Balances.Snapshot memory portfolioValue = Balances.snapshot(
            tokens,
            priceOracle
        );
        value = portfolioValue.totalValue;
    }

    function portfolioTokens() public view returns (address[] memory toks) {
        toks = tokens;
    }

    function getTokenBalances(address account)
        public
        view
        returns (uint256[] memory balances)
    {
        balances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            balances[i] = ERC20(tokens[i]).balanceOf(account);
        }
    }

    // Loops through tokens and verifies there is no transferFrom allowance
    // TODO: set allowance to 0 instead of reverting?
    modifier noApprovals(address[] memory toks, address receiver) {
        _;
        // Make sure tokens aren't approved
        for (uint256 i = 0; i < toks.length; i++) {
            require(
                ERC20(toks[i]).allowance(address(this), receiver) == 0,
                "Tokens are still approved to rebalancer"
            );
        }
    }
}
