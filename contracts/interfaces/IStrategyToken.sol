//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "./IStrategyFees.sol";
import "./IStrategyTokenBase.sol";

interface IStrategyToken is IStrategyFees, IStrategyTokenBase {
    function initialize(string memory name, string memory symbol, string memory version, address manager) external returns(bool);
    // protected by _onlyStrategy
    function mint(address account, uint256 amount) external;

    // protected by _onlyStrategy
    function burn(address account, uint256 amount) external returns (uint256);
}
