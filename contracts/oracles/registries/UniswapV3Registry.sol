//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-core/contracts/libraries/FixedPoint96.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "../../interfaces/registries/IUniswapV3Registry.sol";


contract UniswapV3Registry is IUniswapV3Registry, Ownable {
    using SafeMath for uint256;

    IUniswapV3Factory public immutable override factory;
    address public immutable override weth;

    uint32 public override timeWindow;

    mapping(address => PoolData) internal _pools;

    mapping(bytes32 => uint24) internal _fees;

    constructor(uint32 timeWindow_, address factory_, address weth_) public {
        factory = IUniswapV3Factory(factory_);
        weth = weth_;
        timeWindow = timeWindow_;
    }

    function batchAddPools(
        address[] memory tokens,
        address[] memory pairs,
        uint24[] memory fees
    ) external override onlyOwner {
        uint length = tokens.length;
        require(length == pairs.length, "Array mismatch");
        require(length == fees.length, "Array mismatch");
        for (uint256 i = 0; i < length; i++) {
            _addPool(tokens[i], pairs[i], fees[i]);
        }
    }

    function addPool(address token, address pair, uint24 fee) public override onlyOwner {
        _addPool(token, pair, fee);
    }
    function removePool(address token) external override onlyOwner {
        address pair = _pools[token].pair;
        delete _pools[token];
        delete _fees[_hash(token ,pair)];
    }

    function getPoolData(address token) external view override returns (PoolData memory) {
        return _pools[token];
    }

    function getFee(address token, address pair) external view override returns (uint24) {
        return _fees[_hash(token, pair)];
    }

    function updateTimeWindow(uint32 newTimeWindow) external onlyOwner {
        require(timeWindow != newTimeWindow, "Wrong time window");
        require(newTimeWindow != 0, "Wrong time window");
        timeWindow = newTimeWindow;
    }

    function _addPool(address token, address pair, uint24 fee) internal {
        address pool = factory.getPool(token, pair, fee);
        require(pool != address(0), "Not valid pool");
        _pools[token] = PoolData(
            pool,
            pair
        );
        _fees[_hash(token, pair)] = fee;
        (, , , , uint16 observationCardinalityNext, , ) = IUniswapV3Pool(pool).slot0();
        if (observationCardinalityNext < 2) IUniswapV3Pool(pool).increaseObservationCardinalityNext(2);
    }

    function _hash(address a, address b) internal pure returns (bytes32) {
        if (a < b) {
            return keccak256(abi.encodePacked(a, b));
        } else {
            return keccak256(abi.encodePacked(b, a));
        }
    }


}
