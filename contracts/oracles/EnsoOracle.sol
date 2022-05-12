//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IOracle.sol";
import "../helpers/StrategyTypes.sol";

contract EnsoOracle is IOracle, StrategyTypes {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    address public immutable override weth;
    address public immutable override susd;
    ITokenRegistry public immutable override tokenRegistry;

    event NewPrice(address token, uint256 price);

    constructor(
        address tokenRegistry_,
        address weth_,
        address susd_
    ) public {
        tokenRegistry = ITokenRegistry(tokenRegistry_);
        weth = weth_;
        susd = susd_;
    }

    function estimateStrategy(IStrategy strategy) public view override returns (uint256, int256[] memory) {
        address[] memory strategyItems = strategy.items();
        address[] memory strategyDebt = strategy.debt();
        int256 total = int256(IERC20(weth).balanceOf(address(strategy))); //WETH is never part of items array but always included in total value
        int256[] memory estimates = new int256[](strategyItems.length + strategyDebt.length + 1); // +1 for virtual item
        for (uint256 i = 0; i < strategyItems.length; i++) {
            int256 estimate = estimateItem(
                address(strategy),
                strategyItems[i]
            );
            total = total.add(estimate);
            estimates[i] = estimate;
        }
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            int256 estimate = estimateItem(
                address(strategy),
                strategyDebt[i]
            );
            total = total.add(estimate);
            estimates[i + strategyItems.length] = estimate;
        }
        address[] memory strategySynths = strategy.synths();
        if (strategySynths.length > 0) {
            // All synths rely on the chainlink oracle
            IEstimator chainlinkEstimator = tokenRegistry.estimators(uint256(EstimatorCategory.CHAINLINK_ORACLE));
            int256 estimate = 0;
            for (uint256 i = 0; i < strategySynths.length; i++) {
                estimate = estimate.add(chainlinkEstimator.estimateItem(
                    address(strategy),
                    strategySynths[i]
                ));
            }
            estimate = estimate.add(chainlinkEstimator.estimateItem(
                IERC20(susd).balanceOf(address(strategy)),
                susd
            )); //SUSD is never part of synths array but always included in total value
            total = total.add(estimate);
            estimates[estimates.length - 1] = estimate; //Synths' estimates are pooled together in the virtual item address
        }
        require(total >= 0, "Negative total");
        return (uint256(total), estimates);
    }

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        return tokenRegistry.getEstimator(token).estimateItem(balance, token);
    }

    function estimateItem(address user, address token) public view override returns (int256) {
        return tokenRegistry.getEstimator(token).estimateItem(user, token);
    }

    function estimateStrategies(IStrategy[] memory strategies) external view returns (uint256[] memory) {
        uint256[] memory totals = new uint256[](strategies.length);
        for (uint256 i = 0; i < strategies.length; i++) {
            (uint256 total, ) = estimateStrategy(strategies[i]);
            totals[i] = total;
        }
        return totals;
    }
}
