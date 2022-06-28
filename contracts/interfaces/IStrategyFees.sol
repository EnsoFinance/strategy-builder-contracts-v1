//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;
pragma experimental ABIEncoderV2;

interface IStrategyFees {
    function issueStreamingFee() external;

    function updatePerformanceFee(uint16 fee) external;

    function updateManagementFee(uint16 fee) external;
}
