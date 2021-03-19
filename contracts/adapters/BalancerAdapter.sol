//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./ExchangeAdapter.sol";

interface PoolInterface {
    function swapExactAmountIn(address, uint, address, uint, uint) external returns (uint, uint);
    function swapExactAmountOut(address, uint, address, uint, uint) external returns (uint, uint);
    function calcInGivenOut(uint, uint, uint, uint, uint, uint) external pure returns (uint);
    function calcOutGivenIn(uint, uint, uint, uint, uint, uint) external pure returns (uint);
    function getDenormalizedWeight(address) external view returns (uint);
    function getBalance(address) external view returns (uint);
    function getSwapFee() external view returns (uint);
}

interface RegistryInterface {
    function getBestPoolsWithLimit(address, address, uint) external view returns (address[] memory);
}

contract BalancerAdapter is ExchangeAdapter {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct Pool {
        address pool;
        uint    tokenBalanceIn;
        uint    tokenWeightIn;
        uint    tokenBalanceOut;
        uint    tokenWeightOut;
        uint    swapFee;
        uint    effectiveLiquidity;
    }

    struct Swap {
        address pool;
        address tokenIn;
        address tokenOut;
        uint    swapAmount; // tokenInAmount / tokenOutAmount
        uint    limitReturnAmount; // minAmountOut / maxAmountIn
        uint    maxPrice;
    }

    address internal _registry;
    uint256 private constant BONE = 10**18;
    uint256 private constant NPOOLS = 3;

    constructor(address registry_, address weth_) public ExchangeAdapter(weth_) {
        _registry = registry_;
        _package = abi.encode(registry_);
    }

    function spotPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
      (, uint256 totalAmountOut) = _viewSplitExactIn(RegistryInterface(_registry), tokenIn, tokenOut, amount, NPOOLS, true);
      return totalAmountOut;
    }

    function swapPrice(
        uint256 amount,
        address tokenIn,
        address tokenOut
    ) external view override returns (uint256) {
        (, uint256 totalAmountOut) = _viewSplitExactIn(RegistryInterface(_registry), tokenIn, tokenOut, amount, NPOOLS, false);
        return totalAmountOut;
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
        address to,
        bytes memory data,
        bytes memory package
    ) public override returns (bool) {
        (data); //Unused for now
        require(tokenIn != tokenOut, "Tokens cannot match");
        Swap[] memory swaps;
        {
            (address registry) = package.length > 0 ? abi.decode(package, (address)) : (_registry);
            (swaps, ) = _viewSplitExactIn(RegistryInterface(registry), tokenIn, tokenOut, amount, NPOOLS, false);
        }
        _batchSwapExactIn(swaps, IERC20(tokenIn), IERC20(tokenOut), from, to, amount, expected);
        return true;
    }

    function _batchSwapExactIn(
        Swap[] memory swaps,
        IERC20 tokenIn,
        IERC20 tokenOut,
        address from,
        address to,
        uint totalAmountIn,
        uint minTotalAmountOut
    )
        internal
        returns (uint totalAmountOut)
    {
        tokenIn.safeTransferFrom(from, address(this), totalAmountIn);

        for (uint i = 0; i < swaps.length; i++) {
            Swap memory _swap = swaps[i];
            IERC20 SwapTokenIn = IERC20(_swap.tokenIn);
            PoolInterface pool = PoolInterface(_swap.pool);

            SwapTokenIn.approve(_swap.pool, _swap.swapAmount);

            (uint tokenAmountOut,) = pool.swapExactAmountIn(
                                        _swap.tokenIn,
                                        _swap.swapAmount,
                                        _swap.tokenOut,
                                        _swap.limitReturnAmount,
                                        _swap.maxPrice
                                    );
            totalAmountOut = tokenAmountOut.add(totalAmountOut);
        }

        require(totalAmountOut >= minTotalAmountOut, "ERR_LIMIT_OUT");

        tokenOut.safeTransfer(to, totalAmountOut);
        tokenIn.safeTransfer(from, tokenIn.balanceOf(address(this))); //Return unused funds
    }

    function _viewSplitExactIn(
        RegistryInterface registry,
        address tokenIn,
        address tokenOut,
        uint swapAmount,
        uint nPools,
        bool spot
    )
        internal view
        returns (Swap[] memory swaps, uint totalOutput)
    {
        address[] memory poolAddresses = registry.getBestPoolsWithLimit(tokenIn, tokenOut, nPools);

        Pool[] memory pools = new Pool[](poolAddresses.length);
        uint sumEffectiveLiquidity;
        for (uint i = 0; i < poolAddresses.length; i++) {
            pools[i] = _getPoolData(tokenIn, tokenOut, poolAddresses[i]);
            sumEffectiveLiquidity = sumEffectiveLiquidity.add(pools[i].effectiveLiquidity);
        }

        uint[] memory bestInputAmounts = new uint[](pools.length);
        uint totalInputAmount;
        for (uint i = 0; i < pools.length; i++) {
            bestInputAmounts[i] = swapAmount.mul(pools[i].effectiveLiquidity).div(sumEffectiveLiquidity);
            totalInputAmount = totalInputAmount.add(bestInputAmounts[i]);
        }

        if (totalInputAmount < swapAmount) {
            bestInputAmounts[0] = bestInputAmounts[0].add(swapAmount.sub(totalInputAmount));
        } else {
            bestInputAmounts[0] = bestInputAmounts[0].sub(totalInputAmount.sub(swapAmount));
        }

        swaps = new Swap[](pools.length);

        for (uint i = 0; i < pools.length; i++) {
            swaps[i] = Swap({
                        pool: pools[i].pool,
                        tokenIn: tokenIn,
                        tokenOut: tokenOut,
                        swapAmount: bestInputAmounts[i],
                        limitReturnAmount: 0,
                        maxPrice: uint(-1)
                    });
        }

        totalOutput = _calcTotalOutExactIn(bestInputAmounts, pools, spot);

        return (swaps, totalOutput);
    }

    function _getPoolData(
        address tokenIn,
        address tokenOut,
        address poolAddress
    )
        internal view
        returns (Pool memory)
    {
        PoolInterface pool = PoolInterface(poolAddress);
        uint tokenBalanceIn = pool.getBalance(tokenIn);
        uint tokenBalanceOut = pool.getBalance(tokenOut);
        uint tokenWeightIn = pool.getDenormalizedWeight(tokenIn);
        uint tokenWeightOut = pool.getDenormalizedWeight(tokenOut);
        uint swapFee = pool.getSwapFee();

        uint effectiveLiquidity = _calcEffectiveLiquidity(
                                            tokenWeightIn,
                                            tokenBalanceOut,
                                            tokenWeightOut
                                        );
        Pool memory returnPool = Pool({
            pool: poolAddress,
            tokenBalanceIn: tokenBalanceIn,
            tokenWeightIn: tokenWeightIn,
            tokenBalanceOut: tokenBalanceOut,
            tokenWeightOut: tokenWeightOut,
            swapFee: swapFee,
            effectiveLiquidity: effectiveLiquidity
        });

        return returnPool;
    }

    function _calcEffectiveLiquidity(
        uint tokenWeightIn,
        uint tokenBalanceOut,
        uint tokenWeightOut
    )
        internal pure
        returns (uint effectiveLiquidity)
    {

        // Bo * wi/(wi+wo)
        effectiveLiquidity =
            tokenWeightIn.mul(BONE).div(
                tokenWeightOut.add(tokenWeightIn)
            ).mul(tokenBalanceOut).div(BONE);

        return effectiveLiquidity;
    }

    function _calcTotalOutExactIn(
        uint[] memory bestInputAmounts,
        Pool[] memory bestPools,
        bool spot
    )
        internal pure
        returns (uint totalOutput)
    {
        totalOutput = 0;
        for (uint i = 0; i < bestInputAmounts.length; i++) {
            uint output = PoolInterface(bestPools[i].pool).calcOutGivenIn(
                                bestPools[i].tokenBalanceIn,
                                bestPools[i].tokenWeightIn,
                                bestPools[i].tokenBalanceOut,
                                bestPools[i].tokenWeightOut,
                                bestInputAmounts[i],
                                spot ? 0 : bestPools[i].swapFee
                            );

            totalOutput = totalOutput.add(output);
        }
        return totalOutput;
    }
}
