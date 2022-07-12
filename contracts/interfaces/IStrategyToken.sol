//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "./IStrategy.sol";
import "./IStrategyFees.sol";
import "./IStrategyTokenBase.sol";

interface IStrategyToken is IStrategyFees, IStrategyTokenBase {
    function initialize(string memory name, string memory symbol, string memory version, address manager, uint256 totalSupply) external returns(bool);

    function strategy() external view returns(IStrategy);

    function migrateAccount(address account, uint256 balance, uint256 nonce, uint256 paidTokenValue) external;

    // protected by _onlyStrategy
    function mint(address account, uint256 amount) external;

    // protected by _onlyStrategy
    function burn(address account, uint256 amount) external returns (uint256);
}
