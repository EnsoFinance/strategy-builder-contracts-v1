//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

import "../interfaces/registries/ITokenRegistry.sol";
import "./BaseAdapter.sol";

abstract contract ProtocolAdapter is BaseAdapter {
    ITokenRegistry public immutable tokenRegistry;
    uint256 public immutable categoryIndex;

    constructor(address weth_, address tokenRegistry_, uint256 categoryIndex_) internal BaseAdapter(weth_) {
        require(categoryIndex_ > 0, "Invalid category");
        tokenRegistry = ITokenRegistry(tokenRegistry_);
        categoryIndex = categoryIndex_;
    }

    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to
    ) public virtual override;

    function _checkToken(address token) internal view returns (bool) {
        uint256 estimatorCategoryIndex = tokenRegistry.estimatorCategories(token);
        return estimatorCategoryIndex == categoryIndex;
    }
}
