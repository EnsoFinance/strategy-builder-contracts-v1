import bn from 'bignumber.js'
const hre = require('hardhat')
import { BigNumber } from 'ethers'

const { waffle } = hre
const provider = waffle.provider._hardhatNetwork.provider

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
