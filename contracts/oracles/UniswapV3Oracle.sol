//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import '@uniswap/v3-core/contracts/libraries/FixedPoint96.sol';
import "../interfaces/IOracle.sol";


contract UniswapV3Oracle is IOracle, Ownable {
    using SafeMath for uint256;

    uint24 internal constant defaultFee = 3000; //Mid-tier fee. Arbitrary choice

    address public override weth;
    IUniswapV3Factory public factory;
    uint32 public timeWindow;
    uint24[] public fees;
    mapping(address => address) public pools;


    event NewPrice(address token, uint256 price);

    constructor(uint32 timeWindow_, address factory_, address weth_) public {
        timeWindow = timeWindow_;
        factory = IUniswapV3Factory(factory_);
        weth = weth_;
        fees.push(500);
        fees.push(3000);
        fees.push(10000);
    }

    function addFee(uint24 fee) external onlyOwner {
        for (uint256 i = 0; i < fees.length; i++) {
            require(fees[i] != fee, "Fee already set");
        }
        fees.push(fee);
    }

    function initialize(address input) external {
        IUniswapV3Pool currentPool;
        uint160 currentLiquidity;
        for (uint256 i = 0; i < fees.length; i++) {
          IUniswapV3Pool nextPool = IUniswapV3Pool(factory.getPool(input, weth, fees[i]));
          if (address(nextPool) != address(0)) {
            (, uint160[] memory nextLiquidityCumulatives) = nextPool.observe(_getRange(1)); //Minimum window to avoid 'OLD' reverts
            uint160 nextLiquidity = (nextLiquidityCumulatives[1] - nextLiquidityCumulatives[0]);
            if (nextLiquidity > currentLiquidity) {
              currentPool = nextPool;
              currentLiquidity = nextLiquidity;
            }
          }
        }
        require(address(currentPool) != address(0), "No valid pool");
        pools[input] = address(currentPool);
        (, , , , uint16 observationCardinalityNext, , ) = currentPool.slot0();
        if (observationCardinalityNext < 2) currentPool.increaseObservationCardinalityNext(2);
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
            } else {
                estimate = consult(IERC20(tokens[i]).balanceOf(account), tokens[i]);
            }
            total = total.add(estimate);
            estimates[i] = estimate;
        }
        return (total, estimates);
    }

    function consult(uint256 amount, address input) public view override returns (uint256) {
        if (input == weth) return amount;
        if (amount == 0) return 0;

        IUniswapV3PoolDerivedState pool = pools[input] == address(0)
            ? IUniswapV3Pool(factory.getPool(input, weth, defaultFee))
            : IUniswapV3Pool(pools[input]);

        (int56[] memory tickCumulatives, ) = pool.observe(_getRange(timeWindow));
        int24 tick = int24((tickCumulatives[1] - tickCumulatives[0]) / int24(timeWindow));

        uint256 ratio = (uint256(TickMath.getSqrtRatioAtTick(tick))**2).div(FixedPoint96.Q96);
        if (weth < input) { //sort tokens
          return amount.mul(ratio).div(FixedPoint96.Q96);
        } else {
          return amount.mul(FixedPoint96.Q96).div(ratio);
        }
    }

    function _getRange(uint32 secondsAgo) internal pure returns (uint32[] memory) {
        uint32[] memory range = new uint32[](2);
        range[0] = secondsAgo;
        range[1] = 0;
        return range;
    }
}
