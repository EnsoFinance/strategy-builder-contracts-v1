//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0;

interface IOracle {
    function weth() external view returns (address);

    function consult(uint256 amount, address input) external view returns (uint256);

    function estimateTotal(address account, address[] memory tokens)
        external
        view
        returns (uint256, uint256[] memory);
}
