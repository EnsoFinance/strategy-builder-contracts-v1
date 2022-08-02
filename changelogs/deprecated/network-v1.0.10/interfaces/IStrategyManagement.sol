//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

import "../helpers/StrategyTypes.sol";

interface IStrategyManagement is StrategyTypes {
    function initialize(
        string memory name_,
        string memory symbol_,
        string memory version_,
        address manager_,
        StrategyItem[] memory strategyItems_
    ) external returns (bool);

    function updateManager(address newManager) external;

    function updateVersion(string memory newVersion) external;

    function manager() external view returns (address);
}
