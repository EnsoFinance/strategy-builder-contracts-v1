//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./IProtocolOracle.sol";
import "./ITokenRegistry.sol";
import "./IStrategy.sol";

interface IOracle {
    function weth() external view returns (address);

    function susd() external view returns (address);

    function uniswapOracle() external view returns (IProtocolOracle);

    function chainlinkOracle() external view returns (IProtocolOracle);

    function tokenRegistry() external view returns (ITokenRegistry);

    function estimateStrategy(IStrategy strategy) external view returns (uint256, int256[] memory);

    function estimateItem(
        uint256 balance,
        address token
    ) external view returns (int256);
}
