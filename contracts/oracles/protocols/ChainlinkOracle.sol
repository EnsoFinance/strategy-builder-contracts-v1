//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "../../interfaces/registries/IChainlinkRegistry.sol";
import "./ProtocolOracle.sol";

contract ChainlinkOracle is ProtocolOracle, Ownable {
    using SafeMath for uint256;

    address public immutable override weth;
    IChainlinkRegistry public immutable registry;

    constructor(address registry_, address weth_) public {
        registry = IChainlinkRegistry(registry_);
        weth = weth_;
    }

    function consult(uint256 amount, address input) public view override returns (uint256) {
        if (input == weth || amount == 0) return amount;
        IChainlinkRegistry.ChainlinkOracleData memory oracleData = registry.getOracle(input);
        require(oracleData.oracle != address(0), "Token not initialized");
        return _traversePairs(amount, oracleData);
    }

    function _traversePairs(
        uint256 amount,
        IChainlinkRegistry.ChainlinkOracleData memory oracleData
    ) internal view returns (uint256 value){
        AggregatorV3Interface oracle = AggregatorV3Interface(oracleData.oracle);
        (uint80 roundId, int256 price, , uint256 updatedAt, uint80 answeredInRound) = oracle.latestRoundData();
        require(price != 0, "_traversePairs: price == 0.");
        require(updatedAt != 0, "_traversePairs: updatedAt != 0.");
        require(answeredInRound >= roundId, "_traversePairs: Stale price.");
        if (oracleData.inverse) {
            value = amount.mul(10**uint256(oracle.decimals())).div(uint256(price));
        } else {
            value = amount.mul(uint256(price)) / (10**uint256(oracle.decimals()));
        }
        if (oracleData.pair != weth) {
            IChainlinkRegistry.ChainlinkOracleData memory pairData = registry.getOracle(oracleData.pair);
            require(pairData.oracle != address(0), "Pair not initialized");
            value = _traversePairs(value, pairData);
        }
    }
}
