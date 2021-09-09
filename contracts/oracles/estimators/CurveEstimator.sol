//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../interfaces/IEstimator.sol";
import "../../interfaces/IOracle.sol";
import "../../interfaces/IERC20NonStandard.sol";
import "../../interfaces/curve/ICurveStableSwap.sol";
import "../../interfaces/curve/ICurvePoolRegistry.sol";

contract CurveEstimator is IEstimator {
    using SafeMath for uint256;

    ICurvePoolRegistry public curveRegistry;

    constructor(address curveRegistry_) public {
        curveRegistry = ICurvePoolRegistry(curveRegistry_);
    }

    function estimateItem(uint256 balance, address token) public view override returns (int256) {
        uint256 virtualBalance =
            balance.mul(
                ICurveStableSwap(curveRegistry.swapContracts(token)).get_virtual_price()
            ).div(10**18);

        uint256 coinsInPool = curveRegistry.coinsInPool(token);
        uint256 sumValue = 0;
        for (uint256 i = 0; i < coinsInPool; i++) {
            address underlyingToken = curveRegistry.coins(token, i);
            uint256 decimalDiff = 10**uint256(uint8(18)-IERC20NonStandard(underlyingToken).decimals());
            sumValue = sumValue.add(uint256(IOracle(msg.sender).estimateItem(virtualBalance.div(decimalDiff), underlyingToken)));
        }
        return int256(sumValue.div(coinsInPool));
    }
}
