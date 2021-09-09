//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "./ProtocolOracle.sol";

/*
 * @notice: Looks up Chainlink oracle or fallsback to Uniswap if there is no Chainlink oracle
 */
contract ChainlinkOracle is ProtocolOracle, Ownable {
    using SafeMath for uint256;

    struct ChainlinkOracleData {
        address oracle;
        address pair;
        bool inverse;
    }

    address public override weth;
    mapping(address => ChainlinkOracleData) public chainlinkOracles;

    constructor(address weth_) public {
        weth = weth_;
    }

    function consult(uint256 amount, address input) public view override returns (uint256) {
        if (input == weth) return amount;
        if (amount == 0 || chainlinkOracles[input].oracle == address(0)) return 0;
        return _traversePairs(amount, input);
    }

    function batchAddOracles(
        address[] memory tokens,
        address[] memory pairs,
        address[] memory oracles,
        bool[] memory inverse
    ) external onlyOwner {
        require(tokens.length == oracles.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            ChainlinkOracleData storage oracleData = chainlinkOracles[tokens[i]];
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
    function addOracle(address token, address pair, address oracle, bool inverse) external onlyOwner {
        ChainlinkOracleData storage oracleData = chainlinkOracles[token];
        oracleData.pair = pair;
        oracleData.oracle = oracle;
        oracleData.inverse = inverse;
    }

    function removeOracle(address token) external onlyOwner {
        delete chainlinkOracles[token];
    }

    function _traversePairs(uint256 amount, address input) internal view returns (uint256){
        ChainlinkOracleData storage oracleData = chainlinkOracles[input];
        AggregatorV3Interface oracle = AggregatorV3Interface(oracleData.oracle);
        (, int256 price, , , ) = oracle.latestRoundData();
        uint256 value;
        if (oracleData.inverse) {
            value = amount.mul(10**uint256(oracle.decimals())).div(uint256(price));
        } else {
            value = amount.mul(uint256(price)).div(10**uint256(oracle.decimals()));
        }
        if (oracleData.pair != weth) {
            value = _traversePairs(value, oracleData.pair);
        }
        return value;
    }
}
