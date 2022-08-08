//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

interface IStrategyFees {

    event StreamingFee(uint256 amount);
    event ManagementFee(uint256 amount);

    function managementFee() external view returns (uint256);

    function issueStreamingFee() external;

    function updatePerformanceFee(uint16 fee) external;

    function updateManagementFee(uint16 fee) external;

    function updateTokenValue(uint256 total, uint256 supply) external;

    function withdrawStreamingFee() external;
}
