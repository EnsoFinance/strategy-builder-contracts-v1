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

    function testCTokens(ICToken cETH, ICToken borrow, uint256 borrowAmount) public payable {
      console.log("Stale exchange rate: ", borrow.exchangeRateStored());
      console.log("Exchange rate current: ", borrow.exchangeRateCurrent());
      // Mint
      uint256 value = msg.value;
      cETH.mint{value: value}(); //Convert all ETH to cETH
      //Borrow
      borrow.borrow(borrowAmount);
      console.log("Exchange rate after borrow: ", borrow.exchangeRateStored());
      //Repay
      IERC20 underlying = IERC20(borrow.underlying());
      uint256 underlyingAmount = underlying.balanceOf(address(this));
      underlying.approve(address(borrow), underlyingAmount);
      borrow.repayBorrow(underlyingAmount);
      console.log("Exchange rate after repay: ", borrow.exchangeRateStored());
      //Redeem
      cETH.redeem(IERC20(address(cETH)).balanceOf(address(this)));
      console.log("Exchange rate: ", borrow.exchangeRateStored());
      msg.sender.call{ value : address(this).balance }("");
    }

    receive() external payable {}
}
