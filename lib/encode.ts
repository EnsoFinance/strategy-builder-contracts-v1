import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract } from 'ethers'
import { DEFAULT_DEPOSIT_SLIPPAGE, DIVISOR } from './utils'
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
}

export type Position = {
	token: string
	percentage?: BigNumber
	adapters?: string[]
	path?: string[]
	cache?: string
}

export type ItemData = {
	category: BigNumber
	cache: string
}

export type TradeData = {
	adapters: string[]
	path: string[]
	cache: string
}

export type Item = {
	item: string
	data: ItemData
}

export type StrategyItem = {
	item: string
	percentage: BigNumber
	data: TradeData
}

export type StrategyState = {
	timelock: BigNumber
	rebalanceThreshold: BigNumber
	rebalanceSlippage: BigNumber
	restructureSlippage: BigNumber
	performanceFee: BigNumber
	social: boolean
	set: boolean
}

export function prepareStrategy(positions: Position[], defaultAdapter: string): StrategyItem[]  {
		const items = [] as StrategyItem[]
		positions
			.sort((a, b) => {
				const aNum = BigNumber.from(a.token)
				const bNum = BigNumber.from(b.token)
				return aNum.gt(bNum) ? 1 : -1
			})
			.forEach((position: Position) => {
				if (!position.adapters) position.adapters = [defaultAdapter]
				if (!position.path) position.path = [] // path.length is always 1 less than adapter.length
				const item = encodeStrategyItem(position)
				items.push(item)
			})
		return items
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
		const received = await adapter.spotPrice(amount, tokenIn.address, tokenOut.address)
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
	router: Contract,
	adapter: Contract,
	oracle: Contract,
	weth: Contract
) {
	const calls = []
	const buyLoop = []
	const tokens = await strategy.items()
	const [total, estimates] = await oracle.estimateStrategy(strategy.address)
	let wethInStrategy = false
	// Sell loop
	for (let i = 0; i < tokens.length; i++) {
		const token = await ethers.getContractAt(ERC20.abi, tokens[i])
		const estimatedValue = ethers.BigNumber.from(estimates[i])
		const expectedValue = ethers.BigNumber.from(await getExpectedTokenValue(total, token.address, strategy))
		if (token.address.toLowerCase() != weth.address.toLowerCase()) {
			if (estimatedValue.gt(expectedValue)) {
				//console.log('Sell token: ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString(), ' expected value: ', expectedValue.toString())
				const diff = await adapter.spotPrice(estimatedValue.sub(expectedValue), weth.address, token.address)
				const expected = estimatedValue.sub(expectedValue).mul(DEFAULT_DEPOSIT_SLIPPAGE).div(DIVISOR)
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
			if (expectedValue.gt(0)) wethInStrategy = true
		}
	}
	// Buy loop
	for (let i = 0; i < buyLoop.length; i++) {
		const token = await ethers.getContractAt(ERC20.abi, buyLoop[i].token)
		const estimatedValue = ethers.BigNumber.from(buyLoop[i].estimate)
		if (token.address.toLowerCase() != weth.address.toLowerCase()) {
			if (!wethInStrategy && i == buyLoop.length - 1) {
				//console.log('Buy token:  ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString())
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
				if (estimatedValue.lt(expectedValue)) {
					//console.log('Buy token:  ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString(), ' expected value: ', expectedValue.toString())
					const diff = expectedValue.sub(estimatedValue)
					const expected = BigNumber.from(await adapter.spotPrice(diff, weth.address, token.address)).mul(DEFAULT_DEPOSIT_SLIPPAGE).div(DIVISOR)
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
	strategyItems: StrategyItem[]
) {
	const calls = []
	let wethInStrategy = false
	for (let i = 0; i < strategyItems.length; i++) {
		//const category = strategyItems[i].category
		const category = ethers.BigNumber.from(1);
		if (category.eq(1)) { //BASIC
			const token = await ethers.getContractAt(ERC20.abi, strategyItems[i].item)
			const percentage = strategyItems[i].percentage

			if (token.address.toLowerCase() !== weth.address.toLowerCase()) {
				if (!wethInStrategy && i == strategyItems.length - 1) {
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
					const amount = BigNumber.from(total).mul(percentage).div(DIVISOR)
					const expected = BigNumber.from(await adapter.spotPrice(amount, weth.address, token.address)).mul(DEFAULT_DEPOSIT_SLIPPAGE).div(DIVISOR)
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
				if (percentage.gt(0)) wethInStrategy = true
			}
		}
		if (category.eq(2)) { //STRATEGY
			// TODO: Lookup strategy items + item data, then call prepareDepositMulticall
		}
	}
	/*
	if (wethInStrategy) {
		calls.push(encodeSettleTransferFrom(router, weth.address, controller.address, strategy.address))
	}
	*/
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
	return ethers.utils.splitSignature(await ethers.provider.send('eth_signTypedData_v4', [owner.address, typedData]))
}

export async function calculateAddress(
	strategyFactory: Contract,
	creator: string,
	name: string,
	symbol: string
) {
	const [salt, implementation, admin] = await Promise.all([
		strategyFactory.salt(creator, name, symbol),
		strategyFactory.implementation(),
		strategyFactory.admin()
	])
	const Proxy = await getContractFactory('TransparentUpgradeableProxy')

	const deployTx = Proxy.getDeployTransaction(
		implementation,
		admin,
		'0x'
	)
	return ethers.utils.getCreate2Address(strategyFactory.address, salt, ethers.utils.keccak256(deployTx.data))
}

export async function getExpectedTokenValue(total: BigNumber, token: string, strategy: Contract) {
	const percentage = await strategy.getPercentage(token)
	return ethers.BigNumber.from(total).mul(percentage).div(DIVISOR)
}

export async function getRebalanceRange(expectedValue: BigNumber, controller: Contract, strategy: Contract) {
	const threshold = await controller.rebalanceThreshold(strategy.address)
	return ethers.BigNumber.from(expectedValue).mul(threshold).div(DIVISOR)
}

export function encodeStrategyItem(position: Position): StrategyItem {
	const data: TradeData = {
		adapters: position.adapters || [],
		path: position.path || [],
		cache: position.cache || '0x',
	}
  const item = {
    item: position.token,
		percentage: position.percentage || BigNumber.from(0),
		data: data
  }
  return item
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
		accountTo
	])
	return { target: adapter.address, callData: swapEncoded }
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
		accountTo
	])
	return { target: router.address, callData: delegateSwapEncoded }
}

export function encodeUniswapPairSwap(
	pair: Contract,
	amount0Out: BigNumber,
	amount1Out: BigNumber,
	accountTo: string
): Multicall {
	const pairSwapEncoded = pair.interface.encodeFunctionData('swap', [amount0Out, amount1Out, accountTo, '0x'])
	return { target: pair.address, callData: pairSwapEncoded }
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
		accountTo
	])
	return { target: router.address, callData: settleSwapEncoded }
}

export function encodeSettleTransfer(router: Contract, token: string, accountTo: string): Multicall {
	const settleTransferEncoded = router.interface.encodeFunctionData('settleTransfer', [token, accountTo])
	return { target: router.address, callData: settleTransferEncoded }
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
	return { target: router.address, callData: settleTransferFromEncoded }
}

export function encodeTransfer(token: Contract, to: string, amount: BigNumber): Multicall {
	const transferEncoded = token.interface.encodeFunctionData('transfer', [to, amount])
	return { target: token.address, callData: transferEncoded }
}

export function encodeTransferFrom(token: Contract, from: string, to: string, amount: BigNumber): Multicall {
	const transferFromEncoded = token.interface.encodeFunctionData('transferFrom', [from, to, amount])
	return { target: token.address, callData: transferFromEncoded }
}

export function encodeApprove(token: Contract, to: string, amount: BigNumber): Multicall {
	const approveEncoded = token.interface.encodeFunctionData('approve', [to, amount])
	return { target: token.address, callData: approveEncoded }
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
