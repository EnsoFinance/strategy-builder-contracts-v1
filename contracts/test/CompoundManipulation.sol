//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/compound/ICToken.sol";
import "hardhat/console.sol";

contract CompoundManipulation {
    function testCETH(ICToken cETH) public payable {
      console.log("Exchange rate: ", cETH.exchangeRateStored());
      uint256 value = msg.value;
      cETH.mint{value: value}(); //Convert all ETH to cETH
      console.log("Exchange rate: ", cETH.exchangeRateStored());
      uint256 borrowAmount = (value*8)/10;
      cETH.borrow(borrowAmount); //Borrow 80%
      console.log("Exchange rate: ", cETH.exchangeRateStored());
      cETH.repayBorrow{value: address(this).balance}();
      console.log("Exchange rate: ", cETH.exchangeRateStored());
      cETH.redeem(IERC20(address(cETH)).balanceOf(address(this)));
      console.log("Exchange rate: ", cETH.exchangeRateStored());
      msg.sender.call{ value : address(this).balance }("");
    }

    receive() external payable {}
}
