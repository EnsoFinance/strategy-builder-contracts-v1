//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

import "../oracles/protocols/ProtocolOracle.sol";
import "../libraries/UniswapV2Library.sol";

contract UniswapNaiveOracle is ProtocolOracle {
    using SafeMath for uint256;

    address public override weth;
    address public factory;

    constructor(address factory_, address weth_) public {
        factory = factory_;
        weth = weth_;
    }

    function consult(uint256 amount, address input) public view override returns (uint256) {
        if (input == weth) return amount;
        if (amount == 0) return 0;
        address pair = IUniswapV2Factory(factory).getPair(input, weth);
        require(pair != address(0), "consult: pair does not exist.");
        (uint256 reserveA, uint256 reserveB) = UniswapV2Library.getReserves(factory, input, weth);
        return UniswapV2Library.quote(amount, reserveA, reserveB);
    }
}
