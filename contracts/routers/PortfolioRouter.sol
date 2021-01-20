//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "../interfaces/IPortfolioRouter.sol";
import "../interfaces/IWhitelist.sol";


abstract contract PortfolioRouter is IPortfolioRouter { //solhint-disable-line
    address public override weth;
    address public override whitelist;
    bytes internal _package;

    constructor(address weth_, address whitelist_) public {
        weth = weth_;
        whitelist = whitelist_;
    }

    modifier onlyApproved() {
        require(IWhitelist(whitelist).approved(msg.sender), "PortfolioRouter.onlyApproved: Sender not approved");
        _;
    }

    function getPackage() external view override returns (bytes memory) {
        return _package;
    }

    // Abstract external functions to be defined by inheritor
    function spotPrice(uint256 amount, address tokenIn, address tokenOut)
        external view override virtual returns (uint256);

    function swapPrice(uint256 amount, address tokenIn, address tokenOut)
        external view override virtual returns (uint256);

    function swap(
        uint256 amount,
        uint256 expected,
        address tokenIn,
        address tokenOut,
        address from,
        address to,
        bytes memory data,
        bytes memory package
    ) public payable override virtual returns (bool);
}
