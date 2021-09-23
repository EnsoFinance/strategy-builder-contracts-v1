//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IOracle.sol";

contract EnsoOracle is IOracle {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    address public override weth;
    address public override susd;
    IProtocolOracle public override uniswapOracle;
    IProtocolOracle public override chainlinkOracle;
    ITokenRegistry public override tokenRegistry;

    event NewPrice(address token, uint256 price);

    constructor(
        address tokenRegistry_,
        address uniswapOracle_,
        address chainlinkOracle_,
        address weth_,
        address susd_
    ) public {
        tokenRegistry = ITokenRegistry(tokenRegistry_);
        uniswapOracle = IProtocolOracle(uniswapOracle_);
        chainlinkOracle = IProtocolOracle(chainlinkOracle_);
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
                IERC20(strategyItems[i]).balanceOf(address(strategy)),
                strategyItems[i]
            );
            total = total.add(estimate);
            estimates[i] = estimate;
        }
        for (uint256 i = 0; i < strategyDebt.length; i++) {
            int256 estimate = estimateItem(
                IERC20(strategyDebt[i]).balanceOf(address(strategy)),
                strategyDebt[i]
            );
            total = total.add(estimate);
            estimates[i + strategyItems.length] = estimate;
        }
        if (strategy.supportsSynths()) {
            total = total.add(int256(chainlinkOracle.consult(
                IERC20(susd).balanceOf(address(strategy)),
                susd
            ))); //SUSD is never part of synths array but always included in total value
            (uint256 estimate, ) = chainlinkOracle.estimateTotal(address(strategy), strategy.synths());
            total = total.add(int256(estimate));
            estimates[estimates.length - 1] = int256(estimate);
        }
        return (uint256(total), estimates);
    }

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        return tokenRegistry.getEstimator(token).estimateItem(balance, token);
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
