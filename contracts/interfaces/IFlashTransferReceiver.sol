//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

interface IFlashTransferReceiver {
        function receiveFlashTransfer(address from, uint256 amount, bytes memory data) external returns(uint256 repaymentAmount);
}
