import * as fs from "fs";
import hre from "hardhat";
import { BigNumber, Contract } from "ethers";
import { CrawlerOutput, uniV3OraclePools, uniV3Pairs, uniV3FeeToRegister } from "./jsonData";
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import { ITEM_CATEGORY, ESTIMATOR_CATEGORY } from "../../lib/constants";

export enum CrawlerProtocols {
  Null = 0,
  Basic = 1,
  Compound = 2,
  UniV2 = 3,
  AaveV1 = 4,
  AaveV2 = 5,
  AaveV2Debt = 6,
  XSushi = 7,
  SushiLp = 8,
  Curve = 9,
  CurveGauge = 10,
  Synthetix = 11,
  YEarnV1 = 12,
  YEarnV2 = 13,
  Sushi = 14,
}

export const SUSHI_FACTORY = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac"
export const UNI_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
export const UNI_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
export const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
export const MAX_GAS_PRICE = hre.ethers.BigNumber.from('65000000000') // 65 gWEI

interface AdapterDictionary {
  [key: number]: string;
}

export const PROTOCOL_ADAPTER_MAP: AdapterDictionary = {
  1: "UniswapV3Adapter",
  2: "CompoundAdapter",
  3: "UniswapV2Adapter",
  5: "AaveV2Adapter",
  6: "AaveV2Debt",
  9: "CurveLPAdapter",
  10: "CurveGaugeAdapter",
  11: "SynthetixAdapter",
  13: "YEarnV2Adapter",
  14: "SushiAdapter"
}

export function formatProtocol(
  protocol: CrawlerProtocols
): [ITEM_CATEGORY, ESTIMATOR_CATEGORY] {
  switch (protocol) {
    case CrawlerProtocols.Null:
      throw Error("formatProtocol() given Null protocol");
    case CrawlerProtocols.Basic:
      return [ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.DEFAULT_ORACLE];
    case CrawlerProtocols.Compound:
      return [ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.COMPOUND];
    case CrawlerProtocols.UniV2:
      return [ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.UNISWAP_V2_LP];
    case CrawlerProtocols.AaveV1:
      return [ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE_V1];
    case CrawlerProtocols.AaveV2:
      return [ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE_V2];
    case CrawlerProtocols.AaveV2Debt:
      return [ITEM_CATEGORY.DEBT, ESTIMATOR_CATEGORY.AAVE_V2_DEBT];
    case CrawlerProtocols.XSushi:
      // TODO: XSushi not yet ready
      return [ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.DEFAULT_ORACLE];
    case CrawlerProtocols.SushiLp:
      return [ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.SUSHI_LP];
    case CrawlerProtocols.Curve:
      return [ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_LP];
    case CrawlerProtocols.CurveGauge:
      return [ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_GAUGE];
    case CrawlerProtocols.Synthetix:
      return [ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.CHAINLINK_ORACLE];
    case CrawlerProtocols.YEarnV1:
      return [ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V1];
    case CrawlerProtocols.YEarnV2:
      return [ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2];
    default:
      throw Error("formatProtocol(): no matching protocol")
  }
}

export function isSameAddress(addr1: string, addr2: string): boolean {
  return (addr1.toLowerCase() == addr2.toLowerCase())
}

export const write2File = (fileName: string, json: CrawlerOutput) => {
  const data = JSON.stringify(json, null, 2);
  fs.writeFileSync("data/" + fileName, data);
};

export function toErc20(addr: string): Contract {
  return new Contract(addr, ERC20.abi, hre.ethers.provider)
}

export function toLiquidityInfoJSON(pools: AmmLiquidityInfo[]): AmmLiquidityInfoJSON[] {
  return pools.map((pool: AmmLiquidityInfo) => {
    return { ...pool, fee: Number(pool.fee.toString()) }
  })
}

export function addToFeeRegister(token: string, pair: string, fee: number) {
  const index = uniV3FeeToRegister.findIndex((pool: AmmLiquidityInfo) =>
    pool.fee.eq(fee) && ((token == pool.token && pair == pool.pair) || (pair == pool.token && token == pool.pair))
  )
  if (index === -1) {
    const filteredOraclePools = uniV3OraclePools.filter((pool: AmmLiquidityInfo) =>
      (token == pool.token && pair == pool.pair) || (pair == pool.token && token == pool.pair)
    )
    if (filteredOraclePools.length === 0) {
      const pool = uniV3Pairs.find((pool: AmmLiquidityInfo) =>
        pool.fee.eq(fee) && ((token == pool.token && pair == pool.pair) || (pair == pool.token && token == pool.pair))
      )
      if (pool) {
        uniV3FeeToRegister.push(pool)
        write2File('uni_v3_fee_to_register.json', toLiquidityInfoJSON(uniV3FeeToRegister))
        console.log("Fees to register: ", uniV3FeeToRegister.length)
      }
    }
  } else if (!uniV3FeeToRegister[index].fee.eq(fee)) {
    console.log("Updating fee")
    uniV3FeeToRegister[index].fee = BigNumber.from(fee)
    write2File('uni_v3_fee_to_register.json', toLiquidityInfoJSON(uniV3FeeToRegister))
  }
}

export async function estimateTokens(
  oracle: Contract,
  account: string,
  tokens: string[],
): Promise<[BigNumber, BigNumber[]]> {
  const tokensAndBalances = await Promise.all(
    tokens.map(async token => {
      const erc20 = toErc20(token)
      const balance = await erc20.balanceOf(account);
      return {
        token: token,
        balance: balance,
      };
    }),
  );
  const estimates = await Promise.all(
    tokensAndBalances.map(async obj => {
      if (obj.balance.gt(BigNumber.from(0))) {
        return await oracle["estimateItem(uint256,address)"](obj.balance, obj.token)
      } else {
        return BigNumber.from(0)
      }
    }));
  const total = estimates.reduce((a, b) => a.add(b));

  return [total, estimates];
}

export const waitForTransaction = async (
  txFunc: (txArgs: TransactionArgs) => Promise<any>,
  signer: any
) => {
  return new Promise<any>(async (resolve) => {
    let isCalled = false
    while (!isCalled) {
      const tip = await waitForLowGas(signer);
      try {
        const tx = await txFunc({
          maxPriorityFeePerGas: tip,
          maxFeePerGas: MAX_GAS_PRICE
        })
        const receipt = await tx.wait()
        isCalled = true;
        const gasUsed = receipt.gasUsed;
        console.log("Gas used: ", gasUsed.toString())
        resolve(gasUsed)
      } catch (e: any) {
        if (e.toString().includes('max fee per gas less than block base fee')) {
          //try again
          console.log(e);
          continue;
        } else {
          throw new Error(e);
        }
      }
    }
  });
}

export const waitForLowGas = async (signer: any) => {
  return new Promise<any>(async (resolve) => {
    const blockNumber = await hre.ethers.provider.getBlockNumber()
    //console.log('Next Block: ', blockNumber + 1)
    const [block, feeData] = await Promise.all([
      hre.ethers.provider.getBlock(blockNumber),
      signer.getFeeData()
    ])
    const expectedBaseFee = getExpectedBaseFee(block)
    if (expectedBaseFee.eq('0')) {
      console.log('Bad block. Waiting 15 seconds...');
      setTimeout(async () => {
        tip = await waitForLowGas(signer);
        resolve(tip);
      }, 15000);
    }
    // Pay 5% over expected tip
    let tip = feeData.maxPriorityFeePerGas.add(feeData.maxPriorityFeePerGas.div(20))
    const estimatedGasPrice = expectedBaseFee.add(tip)
    //console.log('Expected Base Fee: ', expectedBaseFee.toString())
    //console.log('Estimated Gas Price: ', estimatedGasPrice.toString())
    if (estimatedGasPrice.gt(MAX_GAS_PRICE)) {
      console.log('Gas too high. Waiting 15 seconds...');
      setTimeout(async () => {
        tip = await waitForLowGas(signer);
        resolve(tip);
      }, 15000);
    } else {
      resolve(tip);
    }
  });
}

export const getExpectedBaseFee = (block: any) => {
  let expectedBaseFee = hre.ethers.BigNumber.from('0')
  if (block.baseFeePerGas) {
    const target = block.gasLimit.div(2)
    if (block.gasUsed.gt(target)) {
      const diff = block.gasUsed.sub(target);
      expectedBaseFee = block.baseFeePerGas.add(block.baseFeePerGas.mul(1000).div(8).mul(diff).div(target).div(1000))
    } else {
      const diff = target.sub(block.gasUsed);
      expectedBaseFee = block.baseFeePerGas.sub(block.baseFeePerGas.mul(1000).div(8).mul(diff).div(target).div(1000))
    }
  }
  return expectedBaseFee
}
export function findSupportedV3Pair(token0: string, token1: string): AmmLiquidityInfo {
  const pairs = uniV3Pairs.filter((pool: AmmLiquidityInfo) => isPair(token0, pool.token, token1, pool.pair))
  const pair = pairs.pop()
  if (!pair) throw Error(`Failed to find pair for tokens: ${token0} and ${token1}`)
  return pair
}

export function findSupportedV3Tokens(token0: string, token1: string): boolean {
  const token0Support = uniV3OraclePools.findIndex(pool => pool.token.toLowerCase() === token0.toLowerCase() || pool.pair.toLowerCase() === token0.toLowerCase()) !== -1
  const token1Support = uniV3OraclePools.findIndex(pool => pool.token.toLowerCase() === token1.toLowerCase() || pool.pair.toLowerCase() === token1.toLowerCase()) !== -1
  return token0Support && token1Support
}

export function isPair(token0: string, token0Alt: string, token1: string, token1Alt: string): boolean {
  switch (token0) {
    case token0Alt:
      break
    case token1Alt:
      break
    default:
      return false
  }
  switch (token1) {
    case token0Alt:
      return true
    case token1Alt:
      return true
    default:
      return false
  }
}

export const FILTERED: FilteredDictionary = {
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": true, //ETH virtual address
  "0xca3d75ac011bf5ad07a98d02f18225f9bd9a6bdf": true, //tricrypto - Not supported (use tricrypto2 instead)
  "0x6955a55416a06839309018a8b0cb72c4ddc11f15": true, //tricrypto-gauge - Not supported (underlying is tricrypto)
  //"0xa1e72267084192db7387c8cc1328fade470e4149" : true, //TrueFi TrueUSD
  //"0x0000000000085d4780b73119b644ae5ecd22b376" : true, //TrueUSD
  "0xc11b1268c1a384e55c48c2391d8d480264a3a7f4" : true, //cWBTC - mint is paused
  "0xf5dce57282a584d2746faf1593d3121fcac444dc" : true, //cSAI - mint is paused
  "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5" : true, //cETH - ETH underlying (not WETH)
  "0x9d409a0a012cfba9b15f6d4b36ac57a46966ab9a" : true, //yvBOOST - underlying token is a yVault that doesn't align with interface
  "0xdc7699e0b6dc6bd953cb139084c8cdcc40fe5e64" : true, //solv - low liquidity
  "0xf062f045b17fe309521c10af10d42b4b8d8386de" : true, //shibagold - low liquidity
  "0xf2bd7deab66b18f48caadade734370b3c9f8559b" : true, //fuku - low liquidity
  "0x845838df265dcd2c412a1dc9e959c7d08537f8a2" : true, //cDAI+cUSDC - deposit zap acts unexpectedly
  "0xd6ea40597be05c201845c0bfd2e96a60bacde267" : true, //yvCurve-Compound - underlying is cDAI+cUSDC
  "0xe2f6b9773bf3a015e2aa70741bde1498bdb9425b" : true, //yvUSDC - depreciated
  "0xbfa4d8aa6d8a379abfe7793399d3ddacc5bbecbb" : true, //yvDAI - depreciated
  "0x104edf1da359506548bfc7c25ba1e28c16a70235" : true, //sETHBTC
  "0x0391d2021f89dc339f60fff84546ea23e337750f" : true, //BOND - bad uni v3 liquidity
}

export const MANUAL_TRADE_DATA: TradeDataDictionary = {
  "0x57ab1ec28d129707052df4df418d58a2d46d5f51": { //sUSD
    adapters: ["UniswapV3Adapter", "CurveAdapter"],
    path: ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"]
  },
  "0x6c5024cd4f8a59110119c56f8933403a539555eb": { //aSUSD (token graph finds incorrect path)
    adapters: ["UniswapV3Adapter", "CurveAdapter", "AaveLendAdapter"],
    path: ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "0x57ab1ec28d129707052df4df418d58a2d46d5f51"]
  },
  "0x196f4727526ea7fb1e17b2071b3d8eaa38486988": { //RSV no WETH pair
    adapters: ["UniswapV3Adapter", "UniswapV3Adapter"],
    path: ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"]
  },
  "0xc2ee6b0334c261ed60c72f6054450b61b8f18e35": { //rsv3CRV (not sure why token graph is unable to find path)
    adapters: ["UniswapV3Adapter", "UniswapV3Adapter", "CurveLPAdapter"],
    path: ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "0x196f4727526ea7fb1e17b2071b3d8eaa38486988"]
  },
  "0xc116df49c02c5fd147de25baa105322ebf26bd97": { //yvCurve-RSV (not sure why token graph is unable to find path)
    adapters: ["UniswapV3Adapter", "UniswapV3Adapter", "CurveLPAdapter", "YearnV2Adapter"],
    path: ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "0x196f4727526ea7fb1e17b2071b3d8eaa38486988", "0xc2ee6b0334c261ed60c72f6054450b61b8f18e35"]
  },
  "0xd46ba6d942050d489dbd938a2c909a5d5039a161": { //AMPL - Uniswap crawler defaults to WETH pairs, but AMPL/WETH pools are extremely low liquidity
    adapters: ["UniswapV3Adapter", "UniswapV3Adapter"],
    path: ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"]
  },
  "0x8daebade922df735c38c80c7ebd708af50815faa": { //tBTC - Route via Curve since Uniswap is low liquidity
    adapters: ["UniswapV3Adapter", "CurveAdapter"],
    path: ["0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"]
  },
  "0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202": {
    adapters: ["KyberSwapAdapter"],
    path: []
  },
  "0x2ba592f78db6436527729929aaf6c908497cb200": {
    adapters: [
      "SushiSwapAdapter"
    ],
    path: []
  },
  "0x3832d2f059e55934220881f831be501d180671a7": {
    adapters: [
      "UniswapV3Adapter",
      "UniswapV3Adapter"
    ],
    path: [
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    ]
  },
  "0x1776e1f26f98b1a5df9cd347953a26dd3cb46671": {
    adapters: [
      "UniswapV2Adapter"
    ],
    path: []
  },
  "0x3b96d491f067912d18563d56858ba7d6ec67a6fa": {
    adapters: [
      "UniswapV3Adapter",
      "CurveAdapter",
      "CurveLPAdapter",
      "YEarnV2Adapter"
    ],
    path: [
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "0x674c6ad92fd080e4004b2312b45f796a192d27a0",
      "0x4f3e8f405cf5afc05d68142f3783bdfe13811522"
    ]
  },
  "0xc4daf3b5e2a9e93861c3fbdd25f1e943b8d87417": {
    adapters: [
      "UniswapV3Adapter",
      "CurveAdapter",
      "CurveLPAdapter",
      "YEarnV2Adapter"
    ],
    path: [
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "0x1456688345527be1f37e9e627da0837d6f08c925",
      "0x7eb40e450b9655f4b3cc4259bcc731c63ff55ae6"
    ]
  },
  /*
  "0x0000000000085d4780B73119b644AE5ecd22b376": {
    adapters: [
      "UniswapV3Adapter",
      "UniswapV3Adapter"
    ],
    path: [
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    ]
  },
  "0xD5147bc8e386d91Cc5DBE72099DAC6C9b99276F5": {
    adapters: [
      "UniswapV2Adapter"
    ],
    path: []
  },
  */
}

/*//////////////////////////////////////////////////////////////
                        TYPESCRIPT TYPES
//////////////////////////////////////////////////////////////*/

export type Token = {
  protocol: CrawlerProtocols;
  address: string;
  underlyingAssets: string[];
  derivedAssets: string[];
};

export interface Tokens {
  [key: string]: Token;
}

export type Position = {
  token: string
  adapters: string[]
  path: string[]
}

export interface TokenPair {
  token: string;
  pair: string;
}

export interface AmmPair extends TokenPair {
  pool: string;
  fee: BigNumber;
}

export interface AmmLiquidityInfo extends AmmPair {
  wethValue: number;
}

export interface AmmLiquidityInfoJSON extends TokenPair {
  pool: string;
  wethValue: number;
  fee: number;
};

// TODO: Make tokens_registered.json more readable
// export interface TokenRegistryItem {
//   category: ITEM_CATEGORY,
//   estimator: ESTIMATOR_CATEGORY,
//   address: string
// }

export type TokenRegistryItem = [ITEM_CATEGORY, ESTIMATOR_CATEGORY, string];

export type ChainlinkRegistryInfo = {
  token: string;
  pair: string;
  oracle: string;
  inverse: boolean;
};

export type CurveDepositZapRegistryInfo = {
  token: string;
  pool: string;
  zap: string;
  indexType: BigNumber;
};

export type Trade = {
  token: string,
  protocol: CrawlerProtocols
}

export type WethPath = {
  token: string;
  path: Trade[]
}

export type WethPathDeprecated = {
  token: string;
  path: string[];
  protocol: CrawlerProtocols;
}

export type TradeData = {
  adapters: string[]
  path: string[]
}

export type FailedData = {
  token : string;
  estimatorCategory : BigNumber;
  estimator : string;
}

export interface Positions {
  [key: string]: Position;
}

export type TokenDistanceData = {
  tokenA: string
  tokenB: string
  protocol: CrawlerProtocols
  distance: number
}

export interface ProxyImplementation {
  [key: string]: string;
}

export type TransactionArgs = {
  maxPriorityFeePerGas: BigNumber;
  maxFeePerGas: BigNumber;
}

export interface AmmLiquidityInfoDictionary {
  [key: string]: AmmLiquidityInfo
}

export interface TradeDataDictionary {
  [key: string]: TradeData;
}

interface FilteredDictionary {
  [key: string]: boolean;
}
