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
import "../../helpers/StringUtils.sol";


contract UniswapV3Registry is IUniswapV3Registry, StringUtils, Ownable {
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

    function batchAddFees(
        address[] memory tokens,
        address[] memory pairs,
        uint24[] memory fees
    ) external override onlyOwner {
        uint256 length = tokens.length;
        require(pairs.length == length, "Array mismatch");
        require(fees.length == length, "Array mismatch");
        for (uint256 i = 0; i < length; i++) {
            _addFee(tokens[i], pairs[i], fees[i]);
        }
    }

    function addPool(address token, address pair, uint24 fee, uint32 timeWindow) external override onlyOwner {
        _addPool(token, pair, fee, timeWindow);
    }

    function removePool(address token) external override onlyOwner {
        bytes32 pairId = _pairId[token];
        require(pairId != bytes32(0), "Pool not found");
        delete _pairs[pairId];
        delete _pairId[token];
        emit PoolRemoved(token);
    }

    // @notice Add a fee for a pair without adding related PairData.
    // @dev The fee cannot be set if `addPool` was already called on the token pair.
    //      Since it's missing pairData and token => pairId mapping, it cannot be used by the oracle,
    //      only the UniswapV3Adapter when looking up the preferred fee for a token pair.
    function addFee(address token, address pair, uint24 fee) external override onlyOwner {
        _addFee(token, pair, fee);
    }

    // @notice Remove a fee for a pair that was previously added by the `addFee` function
    // @dev This function cannot remove fees that were set by the `addPool` function
    function removeFee(address token, address pair) external override onlyOwner {
        bytes32 pairId = _pairHash(token, pair);
        PairData memory pairData = _pairs[pairId];
        if (pairData.fee == 0) _revertWith("No fee to remove", token, pair);
        require(pairData.registrationType == RegistrationType.FEE, "Cannot remove pool fee"); // If this fee was registered via `addPool` it must be removed via `removePool`
        delete _pairs[pairId];
        emit FeeRemoved(token, pair);
    }

    function getPoolData(address token) external view override returns (PoolData memory) {
        bytes32 pairId = _pairId[token];
        if (pairId == bytes32(0)) _revertWith("Pool not found", token, address(0));
        PairData memory pairData = _pairs[pairId];
        address pool = PoolAddress.computeAddress(
            address(factory),
            PoolAddress.getPoolKey(token, pairData.pair, pairData.fee)
        );
        return PoolData(pool, pairData.pair, pairData.timeWindow);
    }

    function getFee(address token, address pair) external view override returns (uint24) {
        PairData memory pairData = _pairs[_pairHash(token, pair)];
        if(pairData.registrationType == RegistrationType.NULL) _revertWith("Pair fee not registered", token, pair);
        return pairData.fee;
    }

    function getTimeWindow(address token, address pair) external view override returns (uint32) {
        PairData memory pairData = _pairs[_pairHash(token, pair)];
        if (pairData.registrationType == RegistrationType.NULL) _revertWith("Pair time window not registered", token, pair);
        return  pairData.timeWindow;
    }

    function updateTimeWindow(address token, uint32 timeWindow) external onlyOwner {
        require(timeWindow != 0, "Wrong time window");
        bytes32 pairId = _pairId[token];
        if (pairId == bytes32(0))  _revertWith("Pool not found", token, address(0));
        PairData storage pairData = _pairs[pairId];
        require(timeWindow != pairData.timeWindow, "Wrong time window");
        pairData.timeWindow = timeWindow;
        address pool = PoolAddress.computeAddress(
            address(factory),
            PoolAddress.getPoolKey(token, pairData.pair, pairData.fee)
        );
        _updateObservations(IUniswapV3Pool(pool), timeWindow);
        emit TimeWindowUpdated(token, timeWindow);
    }

    function _addPool(address token, address pair, uint24 fee, uint32 timeWindow) internal {
        address pool = factory.getPool(token, pair, fee);
        if (pool == address(0)) _revertWith("Not valid pool", token, pair);
        bytes32 pairId = _pairHash(token, pair);
        _pairId[token] = pairId;
        _pairs[pairId] = PairData(pair, fee, timeWindow, RegistrationType.POOL);
        _updateObservations(IUniswapV3Pool(pool), timeWindow);
        emit PoolAdded(token, pair, fee, timeWindow);
    }

    function _addFee(address token, address pair, uint24 fee) internal {
        address pool = factory.getPool(token, pair, fee);
        if (pool == address(0)) _revertWith("Not valid pool", token, pair);
        bytes32 pairId = _pairHash(token, pair);
        PairData storage pairData = _pairs[pairId];
        if (pairData.registrationType == RegistrationType.POOL) _revertWith("Pool already registered", token, pair);
        pairData.fee = fee;
        pairData.registrationType = RegistrationType.FEE;
        emit FeeAdded(token, pair, fee);
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

    function _revertWith(string memory _msg, address a, address b) private view {
        if (b != address(0)) revert(string(abi.encodePacked(_msg, " ", toHexString(uint256(a), 20), " ", toHexString(uint256(b), 20))));
        if (a != address(0)) revert(string(abi.encodePacked(_msg, " ", toHexString(uint256(a), 20))));
        revert(string(abi.encodePacked(_msg, " address(0).")));
    }

}
