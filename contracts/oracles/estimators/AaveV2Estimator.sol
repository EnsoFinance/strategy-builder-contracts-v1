//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/aave/IAToken.sol";

contract AaveV2Estimator is IEstimator {
    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        return _estimateItem(balance, token);
    }

    function estimateItem(address user, address token) public view override returns (int256) {
        uint256 balance = IERC20(token).balanceOf(address(user));
        return _estimateItem(balance, token);
    }

    function _estimateItem(uint256 balance, address token) private view returns (int256) {
        address underlyingToken = IAToken(token).UNDERLYING_ASSET_ADDRESS();
        return IOracle(msg.sender).estimateItem(balance, underlyingToken);
    }
}
