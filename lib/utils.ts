const bn = require('bignumber.js')
const hre = require('hardhat')
const { waffle } = hre
const provider = waffle.provider._hardhatNetwork.provider
import { BigNumber } from 'ethers'

export const FEE = 997
export const DIVISOR = 1000
export const UNI_V3_FEE = 3000

export const MAINNET_ADDRESSES = {
	WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
	UNISWAP: '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95',
	BALANCER_REGISTRY: '0x65e67cbc342712DF67494ACEfc06fe951EE93982',
	BALANCER_FACTORY: '0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd',
}

export function increaseTime(seconds: number) {
	return provider.send('evm_increaseTime', [seconds])
}

export const TIMELOCK_CATEGORY = {
	RESTRUCTURE: 0,
	THRESHOLD: 1,
	SLIPPAGE: 2,
	TIMELOCK: 3,
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