//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "../interfaces/IBaseAdapter.sol";

abstract contract BaseAdapter is IBaseAdapter {
    address public immutable weth;

    constructor(address weth_) internal {
        weth = weth_;
    }

    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public virtual override;
}
