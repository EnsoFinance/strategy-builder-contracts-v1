pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;


interface IKeep3rV1Oracle {
    struct Observation {
        uint timestamp;
        uint price0Cumulative;
        uint price1Cumulative;
    }

    function setMinKeep(uint _keep) external;

    function setGovernance(address _governance) external;

    function acceptGovernance() external;

    function updatePair(address pair) external returns (bool);

    function update(address tokenA, address tokenB) external returns (bool);

    function updateFor(uint i, uint length) external returns (bool updated);

    function add(address tokenA, address tokenB) external;

    function work() external;

    function workForFree() external;


    function pairs() external view returns (address[] memory);

    function observationLength(address pair) external view returns (uint);

    function pairFor(address tokenA, address tokenB) external pure returns (address);

    function pairForWETH(address tokenA) external pure returns (address);

    function lastObservation(address pair) external view returns (Observation memory);

    function workable(address pair) external view returns (bool);

    function workable() external view returns (bool);

    function current(address tokenIn, uint amountIn, address tokenOut) external view returns (uint amountOut);

    function quote(
        address tokenIn, uint amountIn, address tokenOut, uint granularity) external view returns (uint amountOut);

    function prices(
        address tokenIn, uint amountIn, address tokenOut, uint points) external view returns (uint[] memory);

    function sample(
        address tokenIn,
        uint amountIn,
        address tokenOut,
        uint points,
        uint window
    ) external view returns (uint[] memory);

    function hourly(
        address tokenIn, uint amountIn, address tokenOut, uint points) external view returns (uint[] memory);

    function daily(
        address tokenIn, uint amountIn, address tokenOut, uint points) external view returns (uint[] memory);

    function weekly(
        address tokenIn, uint amountIn, address tokenOut, uint points) external view returns (uint[] memory);

    function realizedVolatility(
        address tokenIn, uint amountIn, address tokenOut, uint points, uint window) external view returns (uint);

    function realizedVolatilityHourly(
        address tokenIn, uint amountIn, address tokenOut) external view returns (uint);

    function realizedVolatilityDaily(
        address tokenIn, uint amountIn, address tokenOut) external view returns (uint);

    function realizedVolatilityWeekly(
        address tokenIn, uint amountIn, address tokenOut) external view returns (uint);
}
