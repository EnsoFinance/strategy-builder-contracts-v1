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
import uniPoolsJSON from "../../data/uni_v3_highest_fee_pools.json";
import uniToRegisterJSON from "../../data/uni_v3_to_register.json";
import uniRegisteredJSON from "../../data/uni_v3_registered.json";
import sushiPairJson from "../../data/sushi_pairs.json"
import v3Pairs from "../../data/uni_v3_pairs.json";
import v2Pairs from "../../data/uni_v2_pairs.json"
import lowLiquidityTokens from "../../data/distance_too_high.json";
import {
  V2LiquidityInfo,
  V3LiquidityInfoJson,
  V3LiquidityInfo,
  ProxyImplementation,
  Tokens,
  V3RegistryInfo,
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
export type AmmPools = V3RegistryInfo | V3LiquidityInfo | V2LiquidityInfo | TokenPair[]
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
export const sushiPairs: V2LiquidityInfo[] = sushiPairJson;

/*//////////////////////////////////////////////////////////////
                        UNI_V2_PAIRS.JSON
//////////////////////////////////////////////////////////////*/
export const uniV2Pairs: V2LiquidityInfo[] = v2Pairs;

/*//////////////////////////////////////////////////////////////
                        UNI_V3_PAIRS.JSON
//////////////////////////////////////////////////////////////*/
export const uniV3Pairs: V2LiquidityInfo[] = v3Pairs;

/*//////////////////////////////////////////////////////////////
                  UNI_V3_HIGHEST_FEE_POOLS.JSON
//////////////////////////////////////////////////////////////*/
export const uniV3HighestFeePools: V3LiquidityInfo[] = uniPoolsJSON.map((info: V3LiquidityInfoJson) => {
    return {
        ...info,
        fee: hre.ethers.BigNumber.from(info.fee)
    };
});

/*//////////////////////////////////////////////////////////////
                    UNI_V3_TO_REGISTER.JSON
//////////////////////////////////////////////////////////////*/
const uniToRegisterData: V3LiquidityInfoJson[] = uniToRegisterJSON
export const uniV3ToRegister: V3LiquidityInfo[] = uniToRegisterData.map((info) => {
    return {
        ...info,
        fee: hre.ethers.BigNumber.from(info.fee)
    };
});

/*//////////////////////////////////////////////////////////////
                     UNI_V3_REGISTERED.JSON
//////////////////////////////////////////////////////////////*/
const uniRegisteredData: V3LiquidityInfoJson[] = uniRegisteredJSON
export const uniV3Registered: V3LiquidityInfo[] = uniRegisteredData.length > 0 ? uniRegisteredData.map((info) => {
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
export const DistanceTooHigh: TokenDistanceData[] = lowLiquidityTokens;

// /*//////////////////////////////////////////////////////////////
//                       NO_PATHS_TO_WETH.JSON
// //////////////////////////////////////////////////////////////*/
export const NoPathToWeth: string[] = [];
