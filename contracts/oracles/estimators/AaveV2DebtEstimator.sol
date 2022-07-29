//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/aave/IDebtToken.sol";

contract AaveV2DebtEstimator is IEstimator {
    function estimateItem(
        IStrategy strategy,
        address token
    ) public view override returns (int256) {
        uint256 balance = IERC20(token).balanceOf(address(strategy));
        return estimateItem(strategy, token, balance);
    }

    function estimateItem(
        IStrategy strategy,
        address token,
        uint256 balance
    ) public view override returns (int256) {
        address underlyingToken = IDebtToken(token).UNDERLYING_ASSET_ADDRESS();
        return -IOracle(msg.sender).estimateItem(strategy, underlyingToken, balance);
    }
}
