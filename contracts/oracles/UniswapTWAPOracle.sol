//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2OracleLibrary.sol";
import "@uniswap/lib/contracts/libraries/FixedPoint.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/UniswapV2Library.sol";
import "../interfaces/IOracle.sol";


// sliding window oracle that uses observations collected over a window to provide moving price averages in the past
// `windowSize` with a precision of `windowSize / granularity`
// note this is a singleton oracle and only needs to be deployed once per desired parameters, which
// differs from the simple oracle which must be deployed once per pair.
contract UniswapTWAPOracle is IOracle{
    using FixedPoint for *;
    using SafeMath for uint256;

    uint256 private constant BATCH_GAS = 17670; //Cost of calculating reward and sending it in a batch update
    uint256 private constant UPDATE_GAS = 17264; //Cost of calculating reward and sending it in a single token update

    struct Observation {
        uint timestamp;
        uint price0Cumulative;
        uint price1Cumulative;
    }

    address public immutable factory;
    address public override weth;
    // the desired amount of time over which the moving average should be computed, e.g. 24 hours
    uint public immutable windowSize;
    // the number of observations stored for each pair, i.e. how many price observations are stored for the window.
    // as granularity increases from 1, more frequent updates are needed, but moving averages become more precise.
    // averages are computed over intervals with sizes in the range:
    //   [windowSize - (windowSize / granularity) * 2, windowSize]
    // e.g. if the window size is 24 hours, and the granularity is 24, the oracle will return the average price for
    //   the period:
    //   [now - [22 hours, 24 hours], now]
    uint8 public immutable granularity;
    // this is redundant with granularity and windowSize, but stored for gas savings & informational purposes.
    uint public immutable periodSize;

    mapping(address => address) private wethPairs;
    // mapping from pair address to a list of price observations of that pair
    mapping(address => Observation[]) public pairObservations;

    constructor(address factory_, address weth_, uint windowSize_, uint8 granularity_) public {
        require(granularity_ > 1, "WethOracle (constructor): GRANULARITY");
        require(
            (periodSize = windowSize_ / granularity_) * granularity_ == windowSize_,
            "WethOracle (constructor): WINDOW_NOT_EVENLY_DIVISIBLE"
        );
        factory = factory_;
        weth = weth_;
        windowSize = windowSize_;
        granularity = granularity_;
    }

    function setupTokens(address[] memory tokens) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token != weth) {
                address pair;
                if (wethPairs[token] == address(0)) {
                    pair = UniswapV2Library.pairFor(factory, token, weth);
                    wethPairs[token] = pair;
                } else {
                    pair = wethPairs[token];
                }
                for (uint256 j = pairObservations[pair].length; j < granularity; j++) {
                    pairObservations[pair].push();
                }
            }
        }
    }

    // update the cumulative price for the observation at the current timestamp. each observation is updated at most
    // once per epoch period.
    function update(address token) external override {
        _update(token);
    }

    function batchUpdate(address[] calldata tokens) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            _update(tokens[i]);
        }
    }

    function estimateTotal(address account, address[] calldata tokens)
        external
        override
        view
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

    // returns the amount out corresponding to the amount in for a given token using the moving average over the time
    // range [now - [windowSize, windowSize - periodSize * 2], now]
    // update must have been called for the bucket corresponding to timestamp `now - windowSize`
    function consult(uint amount, address token) public override view returns (uint256) {
        address pair = UniswapV2Library.pairFor(factory, token, weth);
        Observation storage firstObservation = _getFirstObservationInWindow(pair);

        uint timeElapsed = block.timestamp - firstObservation.timestamp;
        //require(timeElapsed <= windowSize, "WethOracle (consult): MISSING_HISTORICAL_OBSERVATION");
        if (timeElapsed <= windowSize) {
            // should never happen.
            require(timeElapsed >= windowSize - periodSize * 2, "WethOracle (consult): UNEXPECTED_TIME_ELAPSED");

            (uint price0Cumulative, uint price1Cumulative,) = UniswapV2OracleLibrary.currentCumulativePrices(pair);
            (address token0,) = UniswapV2Library.sortTokens(token, weth);

            if (token0 == token) {
                return _computeAmountOut(firstObservation.price0Cumulative, price0Cumulative, timeElapsed, amount);
            } else {
                return _computeAmountOut(firstObservation.price1Cumulative, price1Cumulative, timeElapsed, amount);
            }
        } else {
            (uint256 reserveA, uint256 reserveB) = UniswapV2Library.getReserves(factory, token, weth);
            return UniswapV2Library.quote(amount, reserveA, reserveB);
        }
    }

    // returns the index of the observation corresponding to the given timestamp
    function observationIndexOf(uint timestamp) public view returns (uint8 index) {
        uint epochPeriod = timestamp / periodSize;
        return uint8(epochPeriod % granularity);
    }

    function _update(address token) private returns (bool) {
        if (token != weth) {
            address pair;
            if (wethPairs[token] == address(0)) {
                pair = UniswapV2Library.pairFor(factory, token, weth);
                wethPairs[token] = pair;
            } else {
                pair = wethPairs[token];
            }

            // populate the array with empty observations (first call only)
            for (uint i = pairObservations[pair].length; i < granularity; i++) {
                pairObservations[pair].push();
            }

            // get the observation for the current period
            uint8 observationIndex = observationIndexOf(block.timestamp);
            Observation storage observation = pairObservations[pair][observationIndex];

            // we only want to commit updates once per period (i.e. windowSize / granularity)
            uint timeElapsed = block.timestamp - observation.timestamp;
            if (timeElapsed > periodSize) {
                (uint price0Cumulative, uint price1Cumulative,) = UniswapV2OracleLibrary.currentCumulativePrices(pair);
                observation.timestamp = block.timestamp;
                observation.price0Cumulative = price0Cumulative;
                observation.price1Cumulative = price1Cumulative;
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }

    }

    // returns the observation from the oldest epoch (at the beginning of the window) relative to the current time
    function _getFirstObservationInWindow(address pair) private view returns (Observation storage firstObservation) {
        uint8 observationIndex = observationIndexOf(block.timestamp);
        // no overflow issue. if observationIndex + 1 overflows, result is still zero.
        uint8 firstObservationIndex = (observationIndex + 1) % granularity;
        firstObservation = pairObservations[pair][firstObservationIndex];
    }

    // given the cumulative prices of the start and end of a period, and the length of the period, compute the average
    // price in terms of how much amount out is received for the amount in
    function _computeAmountOut(
        uint priceCumulativeStart, uint priceCumulativeEnd,
        uint timeElapsed, uint amountIn
    ) private pure returns (uint amountOut) {
        // overflow is desired.
        FixedPoint.uq112x112 memory priceAverage = FixedPoint.uq112x112(
            uint224((priceCumulativeEnd - priceCumulativeStart) / timeElapsed)
        );
        amountOut = priceAverage.mul(amountIn).decode144();
    }
}
