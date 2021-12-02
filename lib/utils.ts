const bn = require('bignumber.js')
const hre = require('hardhat')
const { waffle } = hre
const provider = waffle.provider._hardhatNetwork.provider
import { BigNumber } from 'ethers'

export const FEE = 997
export const DIVISOR = 1000
export const UNI_V3_FEE = 3000
export const ORACLE_TIME_WINDOW = 1
export const DEFAULT_DEPOSIT_SLIPPAGE = 995

export const MAINNET_ADDRESSES = {
	WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
	SUSD: '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
	USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
	UNISWAP: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
	BALANCER_REGISTRY: '0x65e67cbc342712DF67494ACEfc06fe951EE93982',
	BALANCER_FACTORY: '0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd',
	AAVE_ADDRESS_PROVIDER: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
	CURVE_ADDRESS_PROVIDER: '0x0000000022D53366457F9d5E68Ec105046FC4383',
	COMPOUND_COMPTROLLER: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B'
}

export enum TIMELOCK_CATEGORY {
	RESTRUCTURE,
	THRESHOLD,
	REBALANCE_SLIPPAGE,
	RESTRUCTURE_SLIPPAGE,
	TIMELOCK,
	PERFORMANCE
}

export enum ITEM_CATEGORY {
	BASIC,
	SYNTH,
	DEBT,
	RESERVE
}

export enum ESTIMATOR_CATEGORY {
	DEFAULT_ORACLE,
	CHAINLINK_ORACLE,
	UNISWAP_TWAP_ORACLE,
	SUSHI_TWAP_ORACLE,
	STRATEGY,
	BLOCKED,
	AAVE,
	AAVE_DEBT,
	BALANCER,
	COMPOUND,
	CURVE,
	CURVE_GAUGE,
	SUSHI_LP,
	SUSHI_FARM,
	UNISWAP_V2_LP,
	UNISWAP_V3_LP,
	YEARN_V1,
	YEARN_V2
}

export async function increaseTime(seconds: number) {
	await provider.send('evm_increaseTime', [seconds])
	return provider.send('evm_mine')
}

export function encodePriceSqrt(reserve1: number, reserve0: number): BigNumber {
	return BigNumber.from(
		  new bn(reserve1.toString())
			  .div(reserve0.toString())
			  .sqrt()
			  .multipliedBy(new bn(2).pow(96))
			  .integerValue(3)
			  .toFixed()
	  )
  }

  export function getMinTick(tickSpacing: number): number {
	  return Math.ceil(-887272 / tickSpacing) * tickSpacing
  }

  export function getMaxTick(tickSpacing: number): number {
	  return Math.floor(887272 / tickSpacing) * tickSpacing
  }

  export async function getDeadline(secondsInFuture: number): Promise<BigNumber> {
	  const blockNumber = await provider.send('eth_blockNumber')
	  const block = await provider.send('eth_getBlockByNumber', [blockNumber, true])
	  return BigNumber.from(block.timestamp).add(secondsInFuture)
  }
