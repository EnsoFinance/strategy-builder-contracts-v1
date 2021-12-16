//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../libraries/SafeERC20.sol";
import "../interfaces/IBaseAdapter.sol";

contract Arbitrager is Ownable {
    using SafeERC20 for IERC20;

    //Assumes a flash loan has already been sent to this contract
    function arbitrageLoan(
        address lender,
        uint256 amount,
        IERC20 loanToken,
        IERC20 pairToken,
        IBaseAdapter sellAdapter,
        IBaseAdapter buyAdapter
    ) external {
        // Do arbitrage trades
        _arbitrage(amount, loanToken, pairToken, sellAdapter, buyAdapter);
        // Return loan
        loanToken.safeTransfer(lender, amount);
        // Withdraw earnings
        _withdraw(loanToken);
    }

    function arbitrage(
        uint256 amount,
        IERC20 arbToken,
        IERC20 pairToken,
        IBaseAdapter sellAdapter,
        IBaseAdapter buyAdapter
    ) external onlyOwner {
        _arbitrage(amount, arbToken, pairToken, sellAdapter, buyAdapter);
    }

    function withdraw(IERC20 token) external onlyOwner {
        _withdraw(token);
    }

    function _arbitrage(
        uint256 amount,
        IERC20 arbToken,
        IERC20 pairToken,
        IBaseAdapter sellAdapter,
        IBaseAdapter buyAdapter
    ) internal {
        arbToken.safeApprove(address(sellAdapter), amount);
        sellAdapter.swap(
            amount,
            0,
            address(arbToken),
            address(pairToken),
            address(this),
            address(this)
        );
        uint256 balance = pairToken.balanceOf(address(this));
        pairToken.safeApprove(address(buyAdapter), balance);
        buyAdapter.swap(
            balance,
            0,
            address(pairToken),
            address(arbToken),
            address(this),
            address(this)
        );
    }

    function _withdraw(IERC20 token) internal {
        token.safeTransfer(owner(), token.balanceOf(address(this)));
    }
}
