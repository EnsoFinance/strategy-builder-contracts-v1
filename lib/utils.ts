const bn = require('bignumber.js')
const hre = require('hardhat')
const { waffle } = hre
const provider = waffle.provider._hardhatNetwork.provider
import { BigNumber } from 'ethers'

export const FEE = 997
export const DIVISOR = 1000
export const UNI_V3_FEE = 3000
export const ORACLE_TIME_WINDOW = 1

export const MAINNET_ADDRESSES = {
	WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
	UNISWAP: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
	BALANCER_REGISTRY: '0x65e67cbc342712DF67494ACEfc06fe951EE93982',
	BALANCER_FACTORY: '0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd',
	COMPOUND_COMPTROLLER: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B'
}

export enum TIMELOCK_CATEGORY {
	RESTRUCTURE,
	THRESHOLD,
	SLIPPAGE,
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
	BASIC,
	STRATEGY,
	SYNTH,
	COMPOUND,
	AAVE,
	AAVE_DEBT,
	YEARN_V1,
	YEARN_V2,
	CURVE,
	CURVE_GAUGE,
	BALANCER,
	UNISWAP_V2,
	UNISWAP_V3,
	SUSHI,
	SUSHI_FARM,
	BLOCKED
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
