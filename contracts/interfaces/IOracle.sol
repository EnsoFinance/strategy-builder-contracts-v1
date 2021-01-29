//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

interface IOracle {
    function weth() external view returns (address);

    function consult(uint256 amount, address input) external view returns (uint256);

    function estimateTotal(address account, address[] memory tokens) external view returns (uint256, uint256[] memory);
}
