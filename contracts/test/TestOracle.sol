//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IOracle.sol";
import "../libraries/UniswapV2Library.sol";


contract TestOracle is IOracle {
    using SafeMath for uint256;

    address public override weth;
    address public factory;

    event NewPrice(address token, uint256 price);

    constructor(address factory_, address weth_) public {
        factory = factory_;
        weth = weth_;
    }

    function update(address token) external {
        (uint256 reserveA, uint256 reserveB) = UniswapV2Library.getReserves(factory, token, weth);
        uint256 amount = 10**18; //Assuming that tokens are using 18 decimals, which isn't always the case in real world
        uint256 price = UniswapV2Library.quote(amount, reserveA, reserveB);
        emit NewPrice(token, price);
    }

    function estimateTotal(address account, address[] memory tokens)
        external
        view
        override
        returns (uint256, uint256[] memory)
    {
        //Loop through tokens and calculate the total
        uint256 total = 0;
        uint256[] memory estimates = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 estimate;
            if (tokens[i] == address(0)) {
                estimate = account.balance;
            } else if (tokens[i] == weth) {
                estimate = IERC20(tokens[i]).balanceOf(account);
            } else {
                uint256 balance = IERC20(tokens[i]).balanceOf(account);
                if (balance > 0) {
                    estimate = consult(balance, tokens[i]);
                } else {
                    estimate = 0;
                }

            }
            total = total.add(estimate);
            estimates[i] = estimate;
        }
        return (total, estimates);
    }

    function consult(uint256 amount, address input) public view override returns (uint256) {
        (uint256 reserveA, uint256 reserveB) = UniswapV2Library.getReserves(factory, input, weth);
        if (amount > 0) {
            return UniswapV2Library.quote(amount, reserveA, reserveB);
        } else {
            return 0;
        }

    }
}
