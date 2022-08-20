import hre from "hardhat";
import tokensJSON from "../../data/tokens.json";
import tokenPositionsJSON from "../../data/token_positions.json"
import protocolTokensJSON from "../../data/tokens_protocols.json";
import underlyingTokensJSON from "../../data/tokens_underlying.json";
import derivedTokensJSON from "../../data/tokens_derived.json";
import registeredTokensJSON from '../../data/tokens_registered.json'
import strategyTokensJSON from '../../data/strategy_tokens.json'
import chainlinkToRegisterJSON from "../../data/chainlink_oracles_to_register.json"
import chainlinkRegisteredJSON from "../../data/chainlink_oracles_registered.json"
import curvePoolsJSON from "../../data/curve_pools.json"
import uniOraclePoolsJSON from "../../data/uni_v3_oracle_pools.json";
import uniFeeToRegisterJSON from "../../data/uni_v3_fee_to_register.json"
import uniToRegisterJSON from "../../data/uni_v3_to_register.json";
import uniRegisteredJSON from "../../data/uni_v3_registered.json";
import sushiPairsJSON from "../../data/sushi_pairs.json"
import uniV3PairsJSON from "../../data/uni_v3_pairs.json";
import uniV2PairsJSON from "../../data/uni_v2_pairs.json"
import lowLiquidityTokens from "../../data/distance_too_high.json";
import {
  AmmLiquidityInfo,
  AmmLiquidityInfoJSON,
  ProxyImplementation,
  Tokens,
  TokenPair,
  TokenRegistryItem,
  Token,
  WethPath,
  WethPathDeprecated,
  Positions,
  TokenDistanceData,
  ChainlinkRegistryInfo,
  CurveDepositZapRegistryInfo,
  TradeDataDictionary
} from "./common";


export type Opcodes = string
export type AmmPools = AmmLiquidityInfo | TokenPair[]
export type TradeDataTypes = WethPath[] | WethPathDeprecated[] | Positions | TokenDistanceData[]
export type CrawlerOutput = AmmPools | TradeDataTypes | ProxyImplementation | Tokens | TokenRegistryItem[] | string[] | Opcodes | {[key: string]: number} | {[key: string]: string[]}


/*//////////////////////////////////////////////////////////////
                           TOKENS.JSON
//////////////////////////////////////////////////////////////*/
export const tokens: Tokens = {};
if (tokensJSON) {
    Object.values(tokensJSON).map((value: any) => {
        const token: Token = {
            ...value,
            protocol: hre.ethers.BigNumber.from(value?.protocol).toNumber(),
        };
        tokens[token.address] = token;
    });
}

/*//////////////////////////////////////////////////////////////
                    TOKENS_POSITIONS.JSON
//////////////////////////////////////////////////////////////*/
export const tokenPositions: TradeDataDictionary = tokenPositionsJSON

/*//////////////////////////////////////////////////////////////
                     TOKENS_PROTOCOLS.JSON
//////////////////////////////////////////////////////////////*/
export const protocolTokens: {[key: string]: number} = protocolTokensJSON as {[key: string]: number}

/*//////////////////////////////////////////////////////////////
                     TOKENS_UNDERLYING.JSON
//////////////////////////////////////////////////////////////*/
export const underlyingTokens: {[key: string]: string[]} = underlyingTokensJSON as {[key: string]: string[]}

/*//////////////////////////////////////////////////////////////
                     TOKENS_DERIVED.JSON
//////////////////////////////////////////////////////////////*/
export const derivedTokens: {[key: string]: string[]} = derivedTokensJSON as {[key: string]: string[]}

/*//////////////////////////////////////////////////////////////
                     TOKENS_REGISTERED.JSON
//////////////////////////////////////////////////////////////*/
export const registeredTokens: TokenRegistryItem[] = registeredTokensJSON as TokenRegistryItem[]

/*//////////////////////////////////////////////////////////////
                     STRATEGY_TOKENS.JSON
//////////////////////////////////////////////////////////////*/
export const strategyTokens: string[] = strategyTokensJSON

/*//////////////////////////////////////////////////////////////
                        SUSHI_PAIRS.JSON
//////////////////////////////////////////////////////////////*/
export const sushiPairs: AmmLiquidityInfo[] = sushiPairsJSON.map((info: AmmLiquidityInfoJSON) => {
    return {
        ...info,
        fee: hre.ethers.BigNumber.from(info.fee)
    };
});

/*//////////////////////////////////////////////////////////////
                        UNI_V2_PAIRS.JSON
//////////////////////////////////////////////////////////////*/
export const uniV2Pairs: AmmLiquidityInfo[] = uniV2PairsJSON.map((info: AmmLiquidityInfoJSON) => {
    return {
        ...info,
        fee: hre.ethers.BigNumber.from(info.fee)
    };
});

/*//////////////////////////////////////////////////////////////
                        UNI_V3_PAIRS.JSON
//////////////////////////////////////////////////////////////*/
export const uniV3Pairs: AmmLiquidityInfo[] = uniV3PairsJSON.map((info: AmmLiquidityInfoJSON) => {
    return {
        ...info,
        fee: hre.ethers.BigNumber.from(info.fee)
    };
});

/*//////////////////////////////////////////////////////////////
                      UNI_V3_ORACLE_POOLS.JSON
//////////////////////////////////////////////////////////////*/
export const uniV3OraclePools: AmmLiquidityInfo[] = uniOraclePoolsJSON.map((info: AmmLiquidityInfoJSON) => {
    return {
        ...info,
        fee: hre.ethers.BigNumber.from(info.fee)
    };
});

/*//////////////////////////////////////////////////////////////
                    UNI_V3_FEE_TO_REGISTER.JSON
//////////////////////////////////////////////////////////////*/
const uniFeeToRegisterData: AmmLiquidityInfoJSON[] = uniFeeToRegisterJSON
export const uniV3FeeToRegister: AmmLiquidityInfo[] = uniFeeToRegisterData.map((info) => {
    return {
        ...info,
        fee: hre.ethers.BigNumber.from(info.fee)
    };
});

/*//////////////////////////////////////////////////////////////
                    UNI_V3_TO_REGISTER.JSON
//////////////////////////////////////////////////////////////*/
const uniToRegisterData: AmmLiquidityInfoJSON[] = uniToRegisterJSON
export const uniV3ToRegister: AmmLiquidityInfo[] = uniToRegisterData.map((info) => {
    return {
        ...info,
        fee: hre.ethers.BigNumber.from(info.fee)
    };
});

/*//////////////////////////////////////////////////////////////
                     UNI_V3_REGISTERED.JSON
//////////////////////////////////////////////////////////////*/
const uniRegisteredData: AmmLiquidityInfoJSON[] = uniRegisteredJSON
export const uniV3Registered: AmmLiquidityInfo[] = uniRegisteredData.length > 0 ? uniRegisteredData.map((info) => {
    return {
        ...info,
        fee: hre.ethers.BigNumber.from(info.fee)
    };
}) : [];

/*//////////////////////////////////////////////////////////////
                     CHAINLINK_ORACLES.JSON
//////////////////////////////////////////////////////////////*/
export const chainlinkToRegister: ChainlinkRegistryInfo[] = chainlinkToRegisterJSON

/*//////////////////////////////////////////////////////////////
               CHAINLINK_ORACLES_REGISTERED.JSON
//////////////////////////////////////////////////////////////*/
export const chainlinkRegistered: ChainlinkRegistryInfo[] = chainlinkRegisteredJSON

/*//////////////////////////////////////////////////////////////
                        CURVE_POOLS.JSON
//////////////////////////////////////////////////////////////*/
export const curveDepositZapRegistryInfo: CurveDepositZapRegistryInfo[] = curvePoolsJSON ? curvePoolsJSON.map((info) => {
    return {
        ...info,
        indexType: hre.ethers.BigNumber.from(info.indexType)
    };
}) : [];

// /*//////////////////////////////////////////////////////////////
//                      DISTANCE_TOO_HIGH.JSON
// //////////////////////////////////////////////////////////////*/
export const distanceTooHigh: TokenDistanceData[] = lowLiquidityTokens;

// /*//////////////////////////////////////////////////////////////
//                       NO_PATHS_TO_WETH.JSON
// //////////////////////////////////////////////////////////////*/
export const NoPathToWeth: string[] = [];
