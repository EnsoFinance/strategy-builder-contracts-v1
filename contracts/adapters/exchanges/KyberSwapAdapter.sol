//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/SafeERC20.sol";
import "../../interfaces/kyber/IDMMFactory.sol";
import "../../interfaces/kyber/IDMMRouter02.sol";
import "../BaseAdapter.sol";

contract KyberSwapAdapter is BaseAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IDMMFactory public immutable dmmFactory;
    IDMMRouter02 public immutable dmmRouter;

    constructor(address dmmFactory_, address dmmRouter_, address weth_) public BaseAdapter(weth_) {
        dmmFactory = IDMMFactory(dmmFactory_);
        dmmRouter = IDMMRouter02(dmmRouter_);
    }

    /*
     * WARNING: This function can be called by anyone! Never approve this contract
     * to transfer your tokens. It should only ever be called by a contract which
     * approves an exact token amount and immediately swaps the tokens OR is used
     * in a delegate call where this contract NEVER gets approved to transfer tokens.
     */
    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public override {
        require(tokenIn != tokenOut, "Tokens cannot match");

        if (from != address(this)) {
            uint256 beforeBalance = IERC20(tokenIn).balanceOf(address(this));
            IERC20(tokenIn).safeTransferFrom(from, address(this), amount);
            uint256 afterBalance = IERC20(tokenIn).balanceOf(address(this));
            amount = afterBalance.sub(beforeBalance); //In case of transfer fees reducing amount
        }
        // Set up pools path
        address[] memory poolsPath = new address[](1);
        poolsPath[0] = dmmFactory.getPools(IERC20(tokenIn), IERC20(tokenOut))[0];
        // Set up tokens path
        IERC20[] memory path = new IERC20[](2);
        path[0] = IERC20(tokenIn);
        path[1] = IERC20(tokenOut);
        // Approve and swap
        IERC20(tokenIn).safeApprove(address(dmmRouter), amount);
        dmmRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amount,
            expected,
            poolsPath,
            path,
            to,
            block.timestamp
        );
    }
}
