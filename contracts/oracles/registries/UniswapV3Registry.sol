//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/libraries/FixedPoint96.sol";
import "../../interfaces/uniswap/IUniswapV3Registry.sol";


contract UniswapV3Registry is IUniswapV3Registry, Ownable {
    using SafeMath for uint256;

    uint24 public constant override defaultFee = 3000; //Mid-tier fee. Arbitrary choice
    address public override weth;
    IUniswapV3Factory public override factory;
    uint32 public override timeWindow;
    uint24[] public override fees;
    mapping(address => address) public override pools;
    mapping(address => uint24) public override poolFees;

    constructor(uint32 timeWindow_, address factory_, address weth_) public {
        timeWindow = timeWindow_;
        factory = IUniswapV3Factory(factory_);
        weth = weth_;
        fees.push(500);
        fees.push(3000);
        fees.push(10000);
    }

    function addFee(uint24 fee) external override onlyOwner {
        for (uint256 i = 0; i < fees.length; i++) {
            require(fees[i] != fee, "Fee already set");
        }
        fees.push(fee);
    }

    function initialize(address input) external override {
      IUniswapV3Pool currentPool;
      uint128 currentLiquidity;
      uint24 currentFee;
      for (uint256 i = 0; i < fees.length; i++) {
        IUniswapV3Pool nextPool = IUniswapV3Pool(factory.getPool(input, weth, fees[i]));
        if (address(nextPool) != address(0)) {
          uint128 nextLiquidity = nextPool.liquidity();
          if (nextLiquidity > currentLiquidity) {
            currentPool = nextPool;
            currentLiquidity = nextLiquidity;
            currentFee = fees[i];
          }
        }
      }
      require(address(currentPool) != address(0), "No valid pool");
      pools[input] = address(currentPool);
      poolFees[input] = currentFee;
      (, , , , uint16 observationCardinalityNext, , ) = currentPool.slot0();
      if (observationCardinalityNext < 2) currentPool.increaseObservationCardinalityNext(2);
    }

    function getPool(address tokenIn, address tokenOut) external view override returns (IUniswapV3Pool) {
        if (tokenIn != weth && tokenOut != weth)
            return IUniswapV3Pool(factory.getPool(tokenIn, tokenOut, defaultFee));

        address pair = tokenIn == weth ? tokenOut : tokenIn;
        if (pools[pair] == address(0))
           return IUniswapV3Pool(factory.getPool(tokenIn, tokenOut, defaultFee));

        return IUniswapV3Pool(pools[pair]);
    }

    function getRange(uint32 secondsAgo) public pure override returns (uint32[] memory) {
        uint32[] memory range = new uint32[](2);
        range[0] = secondsAgo;
        range[1] = 0;
        return range;
    }
}
