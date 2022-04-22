//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../libraries/SafeERC20.sol";
import "../BaseAdapter.sol";
import "../../interfaces/kyber/ISimpleKyberProxy.sol";

contract KyberSwapAdapter is BaseAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable kyberNetwork;
    address public immutable kyberProxy;

    constructor(address kyberNetwork_, address kyberProxy_, address weth_) public BaseAdapter(weth_) {
        kyberNetwork = kyberNetwork_;
        kyberProxy = kyberProxy_;
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
        IERC20(tokenIn).approve(kyberNetwork, amount);
        uint256 received = ISimpleKyberProxy(kyberProxy).swapTokenToToken(IERC20(tokenIn), amount, IERC20(tokenOut), 0);
        require(received >= expected, "Insufficient tokenOut amount");
    }
}
