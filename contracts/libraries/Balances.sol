// SPDX-License-Identifier: GNU
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../test/TestOracle.sol";

import "hardhat/console.sol";
library Balances {
    using SafeMath for *;
    using console for *;

    uint256 private constant DIVISOR = 1000;

    struct Snapshot {
        uint256[] balances;
        uint256[] prices;
        uint256 totalValue;
    }

    // Loop through provided tokens and get the current prices/balances
    function snapshot(address[] memory tokens, address priceOracle)
        public
        view
        returns (Snapshot memory pValue)
    {
        TestOracle oracle = TestOracle(priceOracle);
        pValue.prices = new uint256[](tokens.length);
        pValue.balances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            pValue.balances[i] = ERC20(tokens[i]).balanceOf(address(this));
            pValue.prices[i] = oracle.consult(pValue.balances[i], tokens[i]);
            // console.log("snapshot: Token", i, "price: ", pValue.prices[i]);
            pValue.totalValue += pValue.prices[i].mul(pValue.balances[i]);
        }
    }

    // Loop through provided tokens and get the current prices/balances
    function snapshotWithPrices(address[] memory tokens, uint256[] memory prices)
        public
        view
        returns (Snapshot memory pValue)
    {
        // pValue.prices = prices;
        pValue.prices = new uint256[](tokens.length);
        pValue.balances = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            pValue.balances[i] = ERC20(tokens[i]).balanceOf(address(this));
            pValue.prices[i] = prices[i];
            // console.log("snapshotWithPrices: Token", i, "price: ", pValue.prices[i]);
            pValue.totalValue += pValue.prices[i].mul(pValue.balances[i]);
        }
    }

    // Get total imbalance
    function getTotalImbalance(
        Snapshot memory self,
        uint256[] memory tokenPercentages
    ) public view returns (uint256 totalImbalance) {
        if (self.totalValue == 0) return 0;
        for (uint256 i = 0; i < tokenPercentages.length; i++) {
            totalImbalance += getTokenImbalance(self, i, tokenPercentages[i]);
        }
    }

    // Percentage of imbalance relative to the current portfolio valuation
    // - Imbalance is relative to the portfolio value, so this means if a portfolio is out of balance:
    // - Large withdraws will increase imbalance if they just take the desired percentage (the current imbalance will be proportionally larger)
    // - Large deposits will reduce imbalance, if they just provide the correct percentage of tokens
    function relativeImbalance(Snapshot memory self, uint256 totalImbalance)
        public
        view
        returns (uint256 slip)
    {
        if (self.totalValue == 0) return 0;
        slip = totalImbalance.mul(DIVISOR).div(self.totalValue);
    }

    // Imbalance of specific token
    function getTokenImbalance(
        Snapshot memory self,
        uint256 index,
        uint256 tokenPercentage
    ) public view returns (uint256 mismatch) {
        if (self.totalValue == 0) return 0;
        uint256 desiredTokenValue =
            expectedTokenValue(self, index, tokenPercentage);
        uint256 actualTokenValue = tokenValue(self, index);
        if (desiredTokenValue == actualTokenValue) return 0;
        mismatch = desiredTokenValue > actualTokenValue
            ? desiredTokenValue.sub(actualTokenValue)
            : actualTokenValue.sub(desiredTokenValue);
    }

    // Returns expected token value at time of snapshot
    function expectedTokenValue(
        Snapshot memory self,
        uint256 index,
        uint256 tokenPercentage
    ) public view returns (uint256) {
        return self.totalValue.mul(tokenPercentage).div(DIVISOR);
    }

    // Returns token value at time of snapshot
    function tokenValue(Snapshot memory self, uint256 index)
        public
        view
        returns (uint256)
    {
        return self.balances[index].mul(self.prices[index]);
    }

    function totalBalance(Balances.Snapshot memory self)
        public
        view
        returns (uint256 balance)
    {
        for (uint256 i = 0; i < self.balances.length; i++) {
            balance += self.balances[i];
        }
    }
}
