import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract } from 'ethers'
import { DIVISOR } from './utils'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'
const hre = require('hardhat')
const { ethers } = hre
const { constants, getContractFactory } = ethers
const { AddressZero } = constants

export const FEE_SIZE = 3

export type Multicall = {
	target: string
	callData: string
	value: BigNumber
}

export type Position = {
	token: string
	percentage: BigNumber
}
// TODO: make builder pattern
export class StrategyBuilder {
	tokens: string[]
	percentages: BigNumber[]
	adapters: string[]
	constructor(positions: Position[], adapter: string) {
		this.tokens = [] as string[]
		this.percentages = [] as BigNumber[]
		this.adapters = [] as string[]
		positions
			.sort((a, b) => {
				const aNum = ethers.BigNumber.from(a.token)
				const bNum = ethers.BigNumber.from(b.token)
				return aNum.sub(bNum)
			})
			.forEach((position) => {
				this.tokens.push(position.token)
				this.percentages.push(position.percentage)
				this.adapters.push(adapter)
			})
	}
}

export async function prepareUniswapSwap(
	router: Contract,
	adapter: Contract,
	factory: Contract,
	from: string,
	to: string,
	amount: BigNumber,
	tokenIn: Contract,
	tokenOut: Contract
) {
	const calls = [] as Multicall[]
	//Get pair address
	const pairAddress = await factory.getPair(tokenIn.address, tokenOut.address)
	if (pairAddress !== AddressZero) {
		const pair = await ethers.getContractAt(UniswapV2Pair.abi, pairAddress)
		//Transfer input token to pair address
		if (from.toLowerCase() === router.address.toLowerCase()) {
			calls.push(encodeTransfer(tokenIn, pairAddress, amount))
		} else {
			calls.push(encodeTransferFrom(tokenIn, from, pairAddress, amount))
		}
		//Swap tokens
		const received = await adapter.swapPrice(amount, tokenIn.address, tokenOut.address)
		const tokenInNum = ethers.BigNumber.from(tokenIn.address)
		const tokenOutNum = ethers.BigNumber.from(tokenOut.address)
		if (tokenInNum.lt(tokenOutNum)) {
			calls.push(encodeUniswapPairSwap(pair, BigNumber.from(0), received, to))
		} else if (tokenOutNum.lt(tokenInNum)) {
			calls.push(encodeUniswapPairSwap(pair, received, BigNumber.from(0), to))
		}
	}
	return calls
}

export async function prepareRebalanceMulticall(
	strategy: Contract,
	controller: Contract,
	router: Contract,
	adapter: Contract,
	oracle: Contract,
	weth: Contract
) {
	const calls = []
	const buyLoop = []
	const tokens = await strategy.items()
	const [total, estimates] = await oracle.estimateTotal(strategy.address, tokens)

	let wethInStrategy = false
	// Sell loop
	for (let i = 0; i < tokens.length; i++) {
		const token = await ethers.getContractAt(ERC20.abi, tokens[i])
		const estimatedValue = ethers.BigNumber.from(estimates[i])
		const expectedValue = ethers.BigNumber.from(await getExpectedTokenValue(total, token.address, strategy))
		const rebalanceRange = ethers.BigNumber.from(await getRebalanceRange(expectedValue, controller, strategy))
		if (token.address.toLowerCase() != weth.address.toLowerCase()) {
			if (estimatedValue.gt(expectedValue.add(rebalanceRange))) {
				//console.log('Sell token: ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString(), ' expected value: ', expectedValue.toString())
				const diff = await adapter.spotPrice(estimatedValue.sub(expectedValue), weth.address, token.address)
				const expected = await adapter.swapPrice(diff, token.address, weth.address)
				calls.push(
					encodeDelegateSwap(
						router,
						adapter.address,
						diff,
						expected,
						token.address,
						weth.address,
						strategy.address,
						strategy.address
					)
				)
			} else {
				buyLoop.push({
					token: tokens[i],
					estimate: estimates[i],
				})
			}
		} else {
			wethInStrategy = true
		}
	}
	// Buy loop
	for (let i = 0; i < buyLoop.length; i++) {
		const token = await ethers.getContractAt(ERC20.abi, buyLoop[i].token)
		const estimatedValue = ethers.BigNumber.from(buyLoop[i].estimate)
		if (token.address.toLowerCase() != weth.address.toLowerCase()) {
			if (!wethInStrategy && i == buyLoop.length - 1) {
				// The last token must use up the remainder of funds, but since balance is unknown, we call this function which does the final cleanup
				calls.push(
					encodeSettleSwap(
						router,
						adapter.address,
						weth.address,
						token.address,
						strategy.address,
						strategy.address
					)
				)
			} else {
				const expectedValue = ethers.BigNumber.from(await getExpectedTokenValue(total, token.address, strategy))
				const rebalanceRange = ethers.BigNumber.from(
					await getRebalanceRange(expectedValue, controller, strategy)
				)
				if (estimatedValue.lt(expectedValue.sub(rebalanceRange))) {
					//console.log('Buy token:  ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString(), ' expected value: ', expectedValue.toString())
					const diff = expectedValue.sub(estimatedValue)
					const expected = await adapter.swapPrice(diff, weth.address, token.address)
					calls.push(
						encodeDelegateSwap(
							router,
							adapter.address,
							diff,
							expected,
							weth.address,
							token.address,
							strategy.address,
							strategy.address
						)
					)
				}
			}
		}
	}
	return calls
}

export async function prepareDepositMulticall(
	strategy: Contract,
	controller: Contract,
	router: Contract,
	adapter: Contract,
	weth: Contract,
	total: BigNumber,
	tokens: string[],
	percentages: BigNumber[]
) {
	const calls = []
	let wethInStrategy = false
	for (let i = 0; i < tokens.length; i++) {
		const token = await ethers.getContractAt(ERC20.abi, tokens[i])

		if (token.address.toLowerCase() !== weth.address.toLowerCase()) {
			if (!wethInStrategy && i == tokens.length - 1) {
				calls.push(
					encodeSettleSwap(
						router,
						adapter.address,
						weth.address,
						token.address,
						controller.address,
						strategy.address
					)
				)
			} else {
				const amount = BigNumber.from(total).mul(percentages[i]).div(DIVISOR)
				const expected = await adapter.swapPrice(amount, weth.address, token.address)
				//console.log('Buy token: ', i, ' estimated value: ', 0, ' expected value: ', amount.toString())
				calls.push(
					encodeDelegateSwap(
						router,
						adapter.address,
						amount,
						expected,
						weth.address,
						token.address,
						controller.address,
						strategy.address
					)
				)
			}
		} else {
			wethInStrategy = true
		}
	}
	if (wethInStrategy) {
		calls.push(encodeSettleTransferFrom(router, weth.address, controller.address, strategy.address))
	}
	return calls
}

export async function preparePermit(
	strategy: Contract,
	owner: SignerWithAddress,
	spender: SignerWithAddress,
	value: BigNumber,
	deadline: BigNumber
) {
	const [name, chainId, nonce, version] = await Promise.all([
		strategy.name(),
		strategy.chainId(),
		strategy.nonces(owner.address),
		strategy.version()
	])
	const typedData = {
		types: {
			EIP712Domain: [
				{ name: 'name', type: 'string' },
				{ name: 'version', type: 'string' },
				{ name: 'chainId', type: 'uint256' },
				{ name: 'verifyingContract', type: 'address' },
			],
			Permit: [
				{ name: 'owner', type: 'address' },
				{ name: 'spender', type: 'address' },
				{ name: 'value', type: 'uint256' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		},
		primaryType: 'Permit',
		domain: {
			name: name,
			version: version,
			chainId: chainId.toString(),
			verifyingContract: strategy.address,
		},
		message: {
			owner: owner.address,
			spender: spender.address,
			value: value.toString(),
			nonce: nonce.toString(),
			deadline: deadline.toString(),
		},
	}

	if (owner.provider === undefined) return Error('Signer isnt connected to the network')
	return ethers.utils.splitSignature(await ethers.provider.send('eth_signTypedData', [owner.address, typedData]))
}

export async function calculateAddress(
	strategyFactory: Contract,
	creator: string,
	name: string,
	symbol: string,
	tokens: string[],
	percentages: BigNumber[]
) {
	const [salt, implementation, version, controller] = await Promise.all([
		strategyFactory.salt(creator, name, symbol),
		strategyFactory.implementation(),
		strategyFactory.version(),
		strategyFactory.controller(),
	])

	const Proxy = await getContractFactory('TransparentUpgradeableProxy')
	const Strategy = await getContractFactory('Strategy')

	const deployTx = Proxy.getDeployTransaction(
		implementation,
		strategyFactory.address,
		Strategy.interface.encodeFunctionData('initialize', [
			name,
			symbol,
			version,
			controller,
			creator,
			tokens,
			percentages,
		])
	)
	return ethers.utils.getCreate2Address(strategyFactory.address, salt, ethers.utils.keccak256(deployTx.data))
}

export async function getExpectedTokenValue(total: BigNumber, token: string, strategy: Contract) {
	const percentage = await strategy.percentage(token)
	return ethers.BigNumber.from(total).mul(percentage).div(DIVISOR)
}

export async function getRebalanceRange(expectedValue: BigNumber, controller: Contract, strategy: Contract) {
	const threshold = await controller.rebalanceThreshold(strategy.address)
	return ethers.BigNumber.from(expectedValue).mul(threshold).div(DIVISOR)
}

export function encodeSwap(
	adapter: Contract,
	amountTokens: BigNumber,
	minTokens: BigNumber,
	tokenIn: string,
	tokenOut: string,
	accountFrom: string,
	accountTo: string
): Multicall {
	const swapEncoded = adapter.interface.encodeFunctionData('swap', [
		amountTokens,
		minTokens,
		tokenIn,
		tokenOut,
		accountFrom,
		accountTo,
		'0x',
		'0x',
	])
	const msgValue = tokenIn === AddressZero ? amountTokens : BigNumber.from(0)
	return { target: adapter.address, callData: swapEncoded, value: msgValue }
}

export function encodeDelegateSwap(
	router: Contract,
	adapter: string,
	amount: BigNumber,
	minTokens: BigNumber,
	tokenIn: string,
	tokenOut: string,
	accountFrom: string,
	accountTo: string
): Multicall {
	const delegateSwapEncoded = router.interface.encodeFunctionData('delegateSwap', [
		adapter,
		amount,
		minTokens,
		tokenIn,
		tokenOut,
		accountFrom,
		accountTo,
		'0x',
	])
	return { target: router.address, callData: delegateSwapEncoded, value: BigNumber.from(0) }
}

export function encodeUniswapPairSwap(
	pair: Contract,
	amount0Out: BigNumber,
	amount1Out: BigNumber,
	accountTo: string
): Multicall {
	const pairSwapEncoded = pair.interface.encodeFunctionData('swap', [amount0Out, amount1Out, accountTo, '0x'])
	return { target: pair.address, callData: pairSwapEncoded, value: BigNumber.from(0) }
}

export function encodeSettleSwap(
	router: Contract,
	adapter: string,
	tokenIn: string,
	tokenOut: string,
	accountFrom: string,
	accountTo: string
): Multicall {
	const settleSwapEncoded = router.interface.encodeFunctionData('settleSwap', [
		adapter,
		tokenIn,
		tokenOut,
		accountFrom,
		accountTo,
		'0x',
	])
	return { target: router.address, callData: settleSwapEncoded, value: BigNumber.from(0) }
}

export function encodeSettleTransfer(router: Contract, token: string, accountTo: string): Multicall {
	const settleTransferEncoded = router.interface.encodeFunctionData('settleTransfer', [token, accountTo])
	return { target: router.address, callData: settleTransferEncoded, value: BigNumber.from(0) }
}

export function encodeSettleTransferFrom(
	router: Contract,
	token: string,
	accountFrom: string,
	accountTo: string
): Multicall {
	const settleTransferFromEncoded = router.interface.encodeFunctionData('settleTransferFrom', [
		token,
		accountFrom,
		accountTo,
	])
	return { target: router.address, callData: settleTransferFromEncoded, value: BigNumber.from(0) }
}

export function encodeTransfer(token: Contract, to: string, amount: BigNumber): Multicall {
	const transferEncoded = token.interface.encodeFunctionData('transfer', [to, amount])
	return { target: token.address, callData: transferEncoded, value: BigNumber.from(0) }
}

export function encodeTransferFrom(token: Contract, from: string, to: string, amount: BigNumber): Multicall {
	const transferFromEncoded = token.interface.encodeFunctionData('transferFrom', [from, to, amount])
	return { target: token.address, callData: transferFromEncoded, value: BigNumber.from(0) }
}

export function encodeApprove(token: Contract, to: string, amount: BigNumber): Multicall {
	const approveEncoded = token.interface.encodeFunctionData('approve', [to, amount])
	return { target: token.address, callData: approveEncoded, value: BigNumber.from(0) }
}

export function encodeWethDeposit(weth: Contract, amount: BigNumber): Multicall {
	const depositEncoded = weth.interface.encodeFunctionData('deposit', [])
	return { target: weth.address, callData: depositEncoded, value: amount }
}

export function encodeEthTransfer(to: string, amount: BigNumber): Multicall {
	return { target: to, callData: '0x0', value: amount }
}

export function encodePath(path: string[], fees: number[]) {
	if (path.length != fees.length + 1) {
	  throw new Error('path/fee lengths do not match')
	}
  
	let encoded = '0x'
	for (let i = 0; i < fees.length; i++) {
	  // 20 byte encoding of the address
	  encoded += path[i].slice(2)
	  // 3 byte encoding of the fee
	  encoded += fees[i].toString(16).padStart(2 * FEE_SIZE, '0')
	}
	// encode the final token
	encoded += path[path.length - 1].slice(2)
  
	return encoded.toLowerCase()
  }