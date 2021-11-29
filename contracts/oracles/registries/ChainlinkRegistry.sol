//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/registries/IChainlinkRegistry.sol";

contract ChainlinkRegistry is IChainlinkRegistry, Ownable {

    mapping(address => ChainlinkOracleData) internal _chainlinkOracles;

    function batchAddOracles(
        address[] memory tokens,
        address[] memory pairs,
        address[] memory oracles,
        bool[] memory inverse
    ) external override onlyOwner {
        require(tokens.length == pairs.length, "Array mismatch");
        require(tokens.length == oracles.length, "Array mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            ChainlinkOracleData storage oracleData = _chainlinkOracles[tokens[i]];
            oracleData.pair = pairs[i];
            oracleData.oracle = oracles[i];
            oracleData.inverse = inverse[i];
        }
    }

    /*
     * @notice: When passing pairs we need to ensure that we use the same contract address
     *          to represent a currency. For ETH we use the WETH address. For national currencies,
     *          we use the Synthetix contracts: e.g. ETH = WETH, USD = SUSD, YEN = SYEN. If a
     *          token is not paired with WETH, there needs to be sufficient chainlink oracles to
     *          determine the price in WETH: e.g. YEN -> ETH needs two oracles (YEN/USD -> USD/ETH)
     */
    function addOracle(address token, address pair, address oracle, bool inverse) external override onlyOwner {
        ChainlinkOracleData storage oracleData = _chainlinkOracles[token];
        oracleData.pair = pair;
        oracleData.oracle = oracle;
        oracleData.inverse = inverse;
    }

    function removeOracle(address token) external override onlyOwner {
        delete _chainlinkOracles[token];
    }

    function getOracle(address token) external view override returns (ChainlinkOracleData memory) {
        return _chainlinkOracles[token];
    }
}
