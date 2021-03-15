const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
const UniswapV2Pair = require('@uniswap/v2-core/build/UniswapV2Pair.json')
const { ethers } = require('hardhat')
const { constants, getContractAt, getContractFactory } = ethers
const { AddressZero } = constants
const { FEE, DIVISOR } = require('./utils.js')

function prepareStrategy(positions, adapter) {
	let strategyTokens = []
	let strategyPercentages = []
	let strategyRouters = []
	positions
		.sort((a, b) => {
			const aNum = ethers.BigNumber.from(a.token)
			const bNum = ethers.BigNumber.from(b.token)
			return aNum.sub(bNum)
		})
		.forEach((position) => {
			strategyTokens.push(position.token)
			strategyPercentages.push(position.percentage)
			strategyRouters.push(adapter)
		})
	return [strategyTokens, strategyPercentages, strategyRouters]
}

async function prepareUniswapSwap(router, adapter, factory, from, to, amount, tokenIn, tokenOut) {
	const calls = []
	//Get pair address
	const pairAddress = await factory.getPair(tokenIn.address, tokenOut.address)
	if (pairAddress !== AddressZero) {
		const pair = await getContractAt(UniswapV2Pair.abi, pairAddress)
		//Transfer input token to pair address
		if (from.toLowerCase() === router.address.toLowerCase()) {
			calls.push(await encodeTransfer(tokenIn, pairAddress, amount))
		} else {
			calls.push(await encodeTransferFrom(tokenIn, from, pairAddress, amount))
		}
		//Swap tokens
		const received = await adapter.swapPrice(amount, tokenIn.address, tokenOut.address)
		const tokenInNum = ethers.BigNumber.from(tokenIn.address)
		const tokenOutNum = ethers.BigNumber.from(tokenOut.address)
		if (tokenInNum.lt(tokenOutNum)) {
			calls.push(await encodeUniswapPairSwap(pair, 0, received, to))
		} else if (tokenOutNum.lt(tokenInNum)) {
			calls.push(await encodeUniswapPairSwap(pair, received, 0, to))
		} else {
			return []
		}
		return calls
	}
}

async function prepareRebalanceMulticall(strategy, controller, router, adapter, oracle, factory, weth) {
	const calls = []
	const buyLoop = []
	const tokens = await strategy.items()
	const [total, estimates] = await oracle.estimateTotal(strategy.address, tokens)

	let wethInStrategy = false
	// Sell loop
	for (let i = 0; i < tokens.length; i++) {
		const token = await getContractAt(ERC20.abi, tokens[i])
		const estimatedValue = ethers.BigNumber.from(estimates[i])
		const expectedValue = ethers.BigNumber.from(await getExpectedTokenValue(total, token.address, strategy))
		const rebalanceRange = ethers.BigNumber.from(await getRebalanceRange(expectedValue, controller, strategy))
		if (estimatedValue.gt(expectedValue.add(rebalanceRange))) {
			//console.log('Sell token: ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString(), ' expected value: ', expectedValue.toString())
			if (token.address.toLowerCase() != weth.address.toLowerCase()) {
				const diff = ethers.BigNumber.from(
					await adapter.spotPrice(estimatedValue.sub(expectedValue), weth.address, token.address)
				)
				//calls.push(await encodeDelegateSwap(router, strategy.address, adapter.address, diff, 0, token.address, weth.address))
				const swapCalls = await prepareUniswapSwap(
					router,
					adapter,
					factory,
					strategy.address,
					router.address,
					diff,
					token,
					weth
				)
				calls.push(...swapCalls)
			} else {
				const diff = estimatedValue.sub(expectedValue)
				calls.push(await encodeTransferFrom(token, strategy.address, controller.address, diff))
				wethInStrategy = true
			}
		} else {
			buyLoop.push({
				token: tokens[i],
				estimate: estimates[i],
			})
		}
	}
	// Buy loop
	for (let i = 0; i < buyLoop.length; i++) {
		const token = await getContractAt(ERC20.abi, buyLoop[i].token)
		const estimatedValue = ethers.BigNumber.from(buyLoop[i].estimate)
		if (token.address.toLowerCase() != weth.address.toLowerCase()) {
			if (!wethInStrategy && i == buyLoop.length - 1) {
				//console.log('Buy token:  ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString())
				// The last token must use up the remainder of funds, but since balance is unknown, we call this function which does the final cleanup
				calls.push(
					await encodeSettleSwap(
						router,
						adapter.address,
						weth.address,
						token.address,
						router.address,
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
					const diff = expectedValue.sub(estimatedValue).mul(FEE).div(DIVISOR)
					const swapCalls = await prepareUniswapSwap(
						router,
						adapter,
						factory,
						router.address,
						strategy.address,
						diff,
						weth,
						token
					)
					calls.push(...swapCalls)
				}
			}
		}
	}
	if (wethInStrategy) {
		calls.push(await encodeSettleTransfer(controller, weth.address, strategy.address))
	}
	return calls
}

async function prepareDepositMulticall(
	strategy,
	controller,
	router,
	adapter,
	factory,
	weth,
	total,
	tokens,
	percentages
) {
	const calls = []
	//calls.push(await encodeWethDeposit(weth, total))
	calls.push(await encodeTransferFrom(weth, controller.address, router.address, total))
	let wethInStrategy = false
	for (let i = 0; i < tokens.length; i++) {
		const token = await getContractAt(ERC20.abi, tokens[i])

		if (token.address.toLowerCase() !== weth.address.toLowerCase()) {
			if (!wethInStrategy && i == tokens.length - 1) {
				calls.push(
					await encodeSettleSwap(
						router,
						adapter.address,
						weth.address,
						token.address,
						router.address,
						strategy.address
					)
				)
			} else {
				const expectedValue = ethers.BigNumber.from(total).mul(percentages[i]).div(DIVISOR)
				//console.log('Buy token: ', i, ' estimated value: ', 0, ' expected value: ', expectedValue.toString())
				const swapCalls = await prepareUniswapSwap(
					router,
					adapter,
					factory,
					router.address,
					strategy.address,
					expectedValue,
					weth,
					token
				)
				calls.push(...swapCalls)
			}
		} else {
			wethInStrategy = true
		}
	}
	if (wethInStrategy) {
		calls.push(await encodeSettleTransfer(router, weth.address, strategy.address))
	}
	return calls
}

async function preparePermit(strategy, owner, spender, value, deadline) {
	const [name, chainId, nonce] = await Promise.all([
		strategy.name(),
		strategy.chainId(),
		strategy.nonces(owner.address),
	])
	const typedData = {
		types: {
			EIP712Domain: [
				{ name: 'name', type: 'string' },
				{ name: 'version', type: 'uint256' },
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
			version: 1,
			chainId: chainId.toString(),
			verifyingContract: strategy.address,
		},
		message: {
			owner: owner.address,
			spender: spender.address,
			value: value,
			nonce: nonce.toString(),
			deadline: deadline,
		},
	}
	return ethers.utils.splitSignature(await owner.provider.send('eth_signTypedData', [owner.address, typedData]))
}

async function calculateAddress(strategyFactory, creator, name, symbol, tokens, percentages) {
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

async function getExpectedTokenValue(total, token, strategy) {
	const percentage = await strategy.percentage(token)
	return ethers.BigNumber.from(total).mul(percentage).div(DIVISOR)
}

async function getRebalanceRange(expectedValue, controller, strategy) {
	const threshold = await controller.rebalanceThreshold(strategy.address)
	return ethers.BigNumber.from(expectedValue).mul(threshold).div(DIVISOR)
}

async function encodeSwap(adapter, amountTokens, minTokens, tokenIn, tokenOut, accountFrom, accountTo) {
	const swapEncoded = await adapter.interface.encodeFunctionData('swap', [
		amountTokens,
		minTokens,
		tokenIn,
		tokenOut,
		accountFrom,
		accountTo,
		'0x',
		'0x',
	])
	const msgValue = tokenIn == AddressZero ? amountTokens : 0
	return { target: adapter.address, callData: swapEncoded, value: msgValue }
}

async function encodeDelegateSwap(router, strategy, adapter, amount, minTokens, tokenIn, tokenOut) {
	const delegateSwapEncoded = await router.interface.encodeFunctionData('delegateSwap', [
		strategy,
		adapter,
		amount,
		minTokens,
		tokenIn,
		tokenOut,
		'0x',
	])
	return { target: router.address, callData: delegateSwapEncoded, value: 0 }
}

async function encodeUniswapPairSwap(pair, amount0Out, amount1Out, accountTo) {
	const pairSwapEncoded = await pair.interface.encodeFunctionData('swap', [amount0Out, amount1Out, accountTo, '0x'])
	return { target: pair.address, callData: pairSwapEncoded, value: 0 }
}

async function encodeSettleSwap(router, adapter, tokenIn, tokenOut, accountFrom, accountTo) {
	const settleSwapEncoded = await router.interface.encodeFunctionData('settleSwap', [
		adapter,
		tokenIn,
		tokenOut,
		accountFrom,
		accountTo,
		'0x',
	])
	return { target: router.address, callData: settleSwapEncoded, value: 0 }
}

async function encodeSettleTransfer(router, token, to) {
	const settleTransferEncoded = await router.interface.encodeFunctionData('settleTransfer', [token, to])
	return { target: router.address, callData: settleTransferEncoded, value: 0 }
}

async function encodeTransfer(token, to, amount) {
	const transferEncoded = await token.interface.encodeFunctionData('transfer', [to, amount])
	return { target: token.address, callData: transferEncoded, value: 0 }
}

async function encodeTransferFrom(token, from, to, amount) {
	const transferFromEncoded = await token.interface.encodeFunctionData('transferFrom', [from, to, amount])
	return { target: token.address, callData: transferFromEncoded, value: 0 }
}

async function encodeApprove(token, to, amount) {
	const approveEncoded = await token.interface.encodeFunctionData('approve', [to, amount])
	return { target: token.address, callData: approveEncoded, value: 0 }
}

async function encodeWethDeposit(weth, amount) {
	const depositEncoded = await weth.interface.encodeFunctionData('deposit', [])
	return { target: weth.address, callData: depositEncoded, value: amount }
}

async function encodeEthTransfer(to, amount) {
	return { target: to, callData: [], value: amount }
}

module.exports = {
	prepareStrategy,
	prepareRebalanceMulticall,
	prepareDepositMulticall,
	preparePermit,
	prepareUniswapSwap,
	getExpectedTokenValue,
	getRebalanceRange,
	calculateAddress,
	encodeSwap,
	encodeSettleSwap,
	encodeDelegateSwap,
	encodeTransfer,
	encodeTransferFrom,
	encodeApprove,
	encodeWethDeposit,
	encodeEthTransfer,
}
