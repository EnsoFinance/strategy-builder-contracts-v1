//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

interface IStrategyProxyFactory {
    function implementation() external view returns (address);

    function controller() external view returns (address);

    function oracle() external view returns (address);

    function whitelist() external view returns (address);

    function version() external view returns (uint256);

    function salt(address manager, string memory name, string memory symbol) external pure returns (bytes32);

    function createStrategy(
        address manager,
        string memory name,
        string memory symbol,
        address[] memory tokens,
        uint256[] memory percentages,
        bool social,
        uint256 fee,
        uint256 threshold,
        uint256 slippage,
        uint256 timelock,
        address router,
        bytes memory data
    ) external payable returns (address);
}
