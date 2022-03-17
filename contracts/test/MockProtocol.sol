//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/SafeERC20.sol";

contract MockProtocol {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable weth;
    mapping(address => uint256) public balances;

    constructor(address weth_) public {
      weth = weth_;
    }

    function deposit(address account, uint256 amount) external {
        IERC20(weth).safeTransferFrom(msg.sender, address(this), amount);
        balances[account] = balances[account].add(amount);
    }
}
