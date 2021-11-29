//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import "../../interfaces/registries/IChainlinkRegistry.sol";
import "./ProtocolOracle.sol";

/*
 * @notice: Looks up Chainlink oracle or fallsback to Uniswap if there is no Chainlink oracle
 */
contract ChainlinkOracle is ProtocolOracle, Ownable {
    using SafeMath for uint256;

    address public override weth;
    IChainlinkRegistry public registry;

    constructor(address registry_, address weth_) public {
        registry = IChainlinkRegistry(registry_);
        weth = weth_;
    }

    function consult(uint256 amount, address input) public view override returns (uint256) {
        if (input == weth || amount == 0) return amount;
        IChainlinkRegistry.ChainlinkOracleData memory oracleData = registry.getOracle(input);
        if (oracleData.oracle == address(0)) return 0;
        return _traversePairs(amount, oracleData);
    }

    function _traversePairs(
        uint256 amount,
        IChainlinkRegistry.ChainlinkOracleData memory oracleData
    ) internal view returns (uint256){
        AggregatorV3Interface oracle = AggregatorV3Interface(oracleData.oracle);
        (, int256 price, , , ) = oracle.latestRoundData();
        uint256 value;
        if (oracleData.inverse) {
            value = amount.mul(10**uint256(oracle.decimals())).div(uint256(price));
        } else {
            value = amount.mul(uint256(price)).div(10**uint256(oracle.decimals()));
        }
        if (oracleData.pair != weth) {
            value = _traversePairs(value, registry.getOracle(oracleData.pair));
        }
        return value;
    }
}
