//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2OracleLibrary.sol";
import "@uniswap/lib/contracts/libraries/FixedPoint.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "../interfaces/IKeep3rV1Oracle.sol";
import "../interfaces/IOracle.sol";
import "../libraries/UniswapV2Library.sol";

contract UniswapLazyOracle is IOracle {
    using FixedPoint for *;
    using SafeMath for uint256;

    uint256 private constant BATCH_GAS = 17670; //Cost of calculating reward and sending it in a batch update
    uint256 private constant UPDATE_GAS = 17264; //Cost of calculating reward and sending it in a single token update

    uint256 private constant UPDATE_THRESHOLD = 5;
    uint256 private constant DIVISOR = 1000;

    struct Observation {
        uint32 timestamp;
        uint32 timestampLast;
        uint256 priceCumulative;
        uint256 priceCumulativeLast;
    }

    address public immutable factory;
    address public override weth;

    mapping(address => address) private keep3rOracles;
    mapping(address => address) private chainlinkOracles;
    // mapping from pair address to a list of price observations of that pair
    mapping(address => Observation) public pairObservations;

    event NewPrice(address token, uint256 price);

    constructor(address factory_, address weth_) public {
        factory = factory_;
        weth = weth_;
    }

    function update(address token) external override {
        _update(token);
        /*
        uint256 _gasBefore = gasleft();
        bool didUpdate = _update(token);
        if (didUpdate) {
            uint256 _gasUsed = _gasBefore.sub(gasleft()).add(UPDATE_GAS);
            uint256 _rewardAmount = _gasUsed.mul(tx.gasprice);
            _reward(_rewardAmount);
            console.log("Reward: ", _rewardAmount);
        }
        */
    }

    function batchUpdate(address[] calldata tokens) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            _update(tokens[i]);
        }
        /*
        uint256 _gasBefore = gasleft();
        uint256 _rewardMultiplier = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            bool didUpdate = _update(tokens[i]);
            if (didUpdate) {
                _rewardMultiplier++;
            }
        }
        if (_rewardMultiplier > 0) {
            uint256 _gasUsed = _gasBefore.sub(gasleft()).add(BATCH_GAS);
            //No reward for tokens that don't get updated
            uint256 _rewardAmount = _gasUsed.mul(tx.gasprice).mul(_rewardMultiplier).div(tokens.length);
            _reward(_rewardAmount);
            console.log("Reward: ", _rewardAmount);
        }
        */
    }

    function estimateTotal(address account, address[] calldata tokens)
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

    function needsUpdate(address token) external view returns (bool) {
        if (
            token == weth ||
            chainlinkOracles[token] != address(0) ||
            keep3rOracles[token] != address(0)
        ) return false;
        address pair = UniswapV2Library.pairFor(factory, token, weth);
        Observation storage observation = pairObservations[pair];
        if (observation.timestamp == 0 || observation.timestampLast == 0) return true;
        uint256 amount = 10 * 18;

        uint256 timeElapsedSinceObservation =
            uint256(observation.timestamp - observation.timestampLast);
        uint256 computedAmount =
            _computeAmountOut(
                observation.priceCumulativeLast,
                observation.priceCumulative,
                timeElapsedSinceObservation,
                amount
            );

        (uint256 reserveA, uint256 reserveB) = UniswapV2Library.getReserves(factory, token, weth);
        uint256 currentAmount = UniswapV2Library.quote(amount, reserveA, reserveB);
        uint256 range = currentAmount.mul(UPDATE_THRESHOLD).div(DIVISOR);
        if (computedAmount > currentAmount.add(range)) return true;
        if (computedAmount < currentAmount.sub(range)) return true;
        return false;
    }

    function consult(uint256 amount, address token) public view override returns (uint256) {
        if (token == weth) return amount;
        address pair = UniswapV2Library.pairFor(factory, token, weth);

        // if time has elapsed since the last update on the pair, mock the accumulated price values
        uint32 blockTimestamp = UniswapV2OracleLibrary.currentBlockTimestamp();
        (uint256 reserve0, uint256 reserve1, uint32 blockTimestampLast) =
            IUniswapV2Pair(pair).getReserves();
        if (blockTimestampLast == blockTimestamp) {
            //NOTE: A swap has happened this block, risk of price manipulation. Try other oracles first
            if (chainlinkOracles[token] != address(0)) {
                (, int256 price, , , ) =
                    AggregatorV3Interface(chainlinkOracles[token]).latestRoundData();
                return uint256(price).mul(amount).div(10**18); // TODO: Get token's decimal value
            }
            if (keep3rOracles[token] != address(0)) {
                return IKeep3rV1Oracle(keep3rOracles[token]).sample(token, amount, weth, 1, 24)[0]; // TODO: Get proper values!
            }
            Observation storage observation = pairObservations[pair];
            if (observation.timestamp > 0 && observation.timestampLast > 0) {
                uint256 timeElapsedSinceObservation =
                    uint256(observation.timestamp - observation.timestampLast);
                return
                    _computeAmountOut(
                        observation.priceCumulativeLast,
                        observation.priceCumulative,
                        timeElapsedSinceObservation,
                        amount
                    );
            }
        }
        //NOTE: This means that no swap has been done this block or there are no
        // valid observations. So just get the current price
        (address token0, ) = UniswapV2Library.sortTokens(token, weth);
        if (token0 == token) {
            return UniswapV2Library.quote(amount, reserve0, reserve1);
        } else {
            return UniswapV2Library.quote(amount, reserve1, reserve0);
        }
    }

    function _update(address token) private returns (bool) {
        if (
            token != weth &&
            chainlinkOracles[token] == address(0) &&
            keep3rOracles[token] == address(0)
        ) {
            address pair = UniswapV2Library.pairFor(factory, token, weth);

            Observation storage observation = pairObservations[pair];
            (, , uint32 blockTimestampLast) = IUniswapV2Pair(pair).getReserves();

            if (blockTimestampLast > observation.timestamp) {
                //Set last values
                observation.timestampLast = observation.timestamp;
                observation.priceCumulativeLast = observation.priceCumulative;
                //Set new values
                observation.timestamp = blockTimestampLast;

                (address token0, ) = UniswapV2Library.sortTokens(token, weth);
                observation.priceCumulative = token0 == token
                    ? IUniswapV2Pair(pair).price0CumulativeLast()
                    : IUniswapV2Pair(pair).price1CumulativeLast();
                emit NewPrice(
                    token,
                    _computeAmountOut(
                        observation.priceCumulativeLast,
                        observation.priceCumulative,
                        observation.timestamp - observation.timestampLast,
                        10**18
                    )
                );
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    // given the cumulative prices of the start and end of a period, and the length of the period, compute the average
    // price in terms of how much amount out is received for the amount in
    function _computeAmountOut(
        uint256 priceCumulativeStart,
        uint256 priceCumulativeEnd,
        uint256 timeElapsed,
        uint256 amountIn
    ) private pure returns (uint256 amountOut) {
        // overflow is desired.
        FixedPoint.uq112x112 memory priceAverage =
            FixedPoint.uq112x112(
                uint224((priceCumulativeEnd - priceCumulativeStart) / timeElapsed)
            );
        amountOut = priceAverage.mul(amountIn).decode144();
    }
}
