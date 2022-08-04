//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "./registries/ITokenRegistry.sol";
import "./IStrategy.sol";

interface IOracle {

    event NewPrice(address token, uint256 price);

    function weth() external view returns (address);

    function susd() external view returns (address);

    function tokenRegistry() external view returns (ITokenRegistry);

    function estimateStrategy(IStrategy strategy) external view returns (uint256, int256[] memory);

    function estimateItem(
        IStrategy strategy,
        address token
    ) external view returns (int256);

    function estimateItem(
        IStrategy strategy,
        address token,
        uint256 balance
    ) external view returns (int256);

    function estimateItem(
        IStrategy strategy,
        address token,
        address underlyingToken,
        uint256 balance
    ) external view returns (int256);

    function updateAddresses() external;
}
