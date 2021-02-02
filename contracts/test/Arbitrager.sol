pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IPortfolioRouter.sol";
import "hardhat/console.sol";


contract Arbitrager is Ownable {

    //Assumes a flash loan has already been sent to this contract
    function arbitrageLoan(
        address lender,
        uint256 amount,
        IERC20 loanToken,
        IERC20 pairToken,
        IPortfolioRouter sellRouter,
        IPortfolioRouter buyRouter
    ) external {
        // Do arbitrage trades
        _arbitrage(amount, loanToken, pairToken, sellRouter, buyRouter);
        // Return loan
        loanToken.transfer(lender, amount);
        // Withdraw earnings
        _withdraw(loanToken);
    }

    function arbitrage(
        uint256 amount,
        IERC20 arbToken,
        IERC20 pairToken,
        IPortfolioRouter sellRouter,
        IPortfolioRouter buyRouter
    ) external onlyOwner {
        _arbitrage(amount, arbToken, pairToken, sellRouter, buyRouter);
    }

    function withdraw(IERC20 token) external onlyOwner {
        _withdraw(token);
    }

    function _arbitrage(
        uint256 amount,
        IERC20 arbToken,
        IERC20 pairToken,
        IPortfolioRouter sellRouter,
        IPortfolioRouter buyRouter
    ) internal {
        arbToken.approve(address(sellRouter), amount);
        sellRouter.swap(
            amount,
            0,
            address(arbToken),
            address(pairToken),
            address(this),
            address(this),
            new bytes(0),
            new bytes(0)
        );
        uint256 balance = pairToken.balanceOf(address(this));
        pairToken.approve(address(buyRouter), balance);
        buyRouter.swap(
            balance,
            0,
            address(pairToken),
            address(arbToken),
            address(this),
            address(this),
            new bytes(0),
            new bytes(0)
        );
    }

    function _withdraw(IERC20 token) internal {
        token.transfer(owner(), token.balanceOf(address(this)));
    }
}
