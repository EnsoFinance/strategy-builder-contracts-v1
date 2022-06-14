//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/libraries/FixedPoint96.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "../../interfaces/registries/IUniswapV3Registry.sol";


contract UniswapV3Registry is IUniswapV3Registry, Ownable {
    using SafeMath for uint256;

    uint16 private constant BLOCK_TIME = 12; // Avg seconds per block (used to determine the maximum number of observations per time window)

    IUniswapV3Factory public immutable override factory;

    address public immutable override weth;

    mapping(address =>  bytes32) internal _pairId;

    mapping(bytes32 => PairData) internal _pairs;


    constructor(address factory_, address weth_) public {
        require(BLOCK_TIME > 0, "Bad constant");
        factory = IUniswapV3Factory(factory_);
        weth = weth_;
    }

    function batchAddPools(
        address[] memory tokens,
        address[] memory pairs,
        uint24[] memory fees,
        uint32[] memory timeWindows
    ) external override onlyOwner {
        uint256 length = tokens.length;
        require(pairs.length == length, "Array mismatch");
        require(fees.length == length, "Array mismatch");
        require(timeWindows.length == length, "Array mismatch");
        for (uint256 i = 0; i < length; i++) {
            _addPool(tokens[i], pairs[i], fees[i], timeWindows[i]);
        }
    }

    function addPool(address token, address pair, uint24 fee, uint32 timeWindow) public override onlyOwner {
        _addPool(token, pair, fee, timeWindow);
    }

    function removePool(address token) external override onlyOwner {
        bytes32 pairId = _pairId[token];
        require(pairId != bytes32(0), "Pool not found");
        delete _pairs[pairId];
        delete _pairId[token];
    }

    function getPoolData(address token) external view override returns (PoolData memory) {
        bytes32 pairId = _pairId[token];
        require(pairId != bytes32(0), "Pool not found");
        PairData memory pairData = _pairs[pairId];
        address pool = PoolAddress.computeAddress(
            address(factory),
            PoolAddress.getPoolKey(token, pairData.pair, pairData.fee)
        );
        return PoolData(pool, pairData.pair, pairData.timeWindow);
    }

    function getFee(address token, address pair) external view override returns (uint24) {
        return _pairs[_pairHash(token, pair)].fee;
    }

    function getTimeWindow(address token, address pair) external view override returns (uint32) {
        return  _pairs[_pairHash(token, pair)].timeWindow;
    }

    function updateTimeWindow(address token, uint32 timeWindow) external onlyOwner {
        require(timeWindow != 0, "Wrong time window");
        bytes32 pairId = _pairId[token];
        require(pairId != bytes32(0), "Pool not found");
        PairData storage pairData = _pairs[pairId];
        require(timeWindow != pairData.timeWindow, "Wrong time window");
        pairData.timeWindow = timeWindow;
        address pool = PoolAddress.computeAddress(
            address(factory),
            PoolAddress.getPoolKey(token, pairData.pair, pairData.fee)
        );
        _updateObservations(IUniswapV3Pool(pool), timeWindow);
    }

    function _addPool(address token, address pair, uint24 fee, uint32 timeWindow) internal {
        address pool = factory.getPool(token, pair, fee);
        require(pool != address(0), "Not valid pool");
        bytes32 pairId = _pairHash(token, pair);
        _pairId[token] = pairId;
        _pairs[pairId] = PairData(pair, fee, timeWindow);
        _updateObservations(IUniswapV3Pool(pool), timeWindow);
    }

    function _updateObservations(IUniswapV3Pool pool, uint32 timeWindow) internal {
        uint16 expectedCardinatilityNext = (SafeCast.toUint16(timeWindow) / BLOCK_TIME) + 2; // BLOCK_TIME always greater than 0, no need for SafeMath
        (, , , , uint16 observationCardinalityNext, , ) = pool.slot0();
        if (observationCardinalityNext < expectedCardinatilityNext)
            pool.increaseObservationCardinalityNext(expectedCardinatilityNext);
    }

    function _pairHash(address a, address b) internal pure returns (bytes32) {
        if (a < b) {
            return keccak256(abi.encodePacked(a, b));
        } else {
            return keccak256(abi.encodePacked(b, a));
        }
    }
}
