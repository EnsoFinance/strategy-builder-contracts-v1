//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/IsEnso.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";


contract sEnsoEstimator is IEstimator {
    using SafeMath for uint256;

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        IsEnso sEnso = IsEnso(token);
        IERC20 enso = IsEnso(token).enso();
        uint256 amount = balance.div(sEnso.distributionTokenScalar());
        return IOracle(msg.sender).estimateItem(amount, address(enso));
    }
}
