pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IKeep3rV1Oracle {
    struct Observation {
        uint256 timestamp;
        uint256 price0Cumulative;
        uint256 price1Cumulative;
    }

    function setMinKeep(uint256 _keep) external;

    function setGovernance(address _governance) external;

    function acceptGovernance() external;

    function updatePair(address pair) external returns (bool);

    function update(address tokenA, address tokenB) external returns (bool);

    function updateFor(uint256 i, uint256 length) external returns (bool updated);

    function add(address tokenA, address tokenB) external;

    function work() external;

    function workForFree() external;

    function pairs() external view returns (address[] memory);

    function observationLength(address pair) external view returns (uint256);

    function pairFor(address tokenA, address tokenB) external pure returns (address);

    function pairForWETH(address tokenA) external pure returns (address);

    function lastObservation(address pair) external view returns (Observation memory);

    function workable(address pair) external view returns (bool);

    function workable() external view returns (bool);

    function current(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) external view returns (uint256 amountOut);

    function quote(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 granularity
    ) external view returns (uint256 amountOut);

    function prices(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 points
    ) external view returns (uint256[] memory);

    function sample(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 points,
        uint256 window
    ) external view returns (uint256[] memory);

    function hourly(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 points
    ) external view returns (uint256[] memory);

    function daily(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 points
    ) external view returns (uint256[] memory);

    function weekly(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 points
    ) external view returns (uint256[] memory);

    function realizedVolatility(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 points,
        uint256 window
    ) external view returns (uint256);

    function realizedVolatilityHourly(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) external view returns (uint256);

    function realizedVolatilityDaily(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) external view returns (uint256);

    function realizedVolatilityWeekly(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) external view returns (uint256);
}
