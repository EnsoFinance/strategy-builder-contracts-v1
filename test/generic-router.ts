// const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { deployUniswapV2, deployTokens, deployPlatform, deployUniswapV2Adapter, deployGenericRouter } from '../lib/deploy'
import {
	prepareStrategy,
	prepareRebalanceMulticall,
	prepareDepositMulticall,
	calculateAddress,
	getExpectedTokenValue,
	encodeSettleSwap,
	encodeSettleTransfer,
	encodeSettleTransferFrom,
	encodeTransfer,
	encodeTransferFrom,
	encodeDelegateSwap,
	Multicall,
	Position,
	StrategyItem,
	InitialState
} from '../lib/encode'
import { DEFAULT_DEPOSIT_SLIPPAGE, DIVISOR } from '../lib/utils'

import { Contract, BigNumber } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 15

export type BuyLoop = {
	token: string
	estimate: BigNumber
}

describe('GenericRouter', function () {
	let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		genericRouter: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		library: Contract,
		adapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract

	before('Setup Uniswap, Factory, GenericRouter', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[0], tokens)
		const platform = await deployPlatform(accounts[0], uniswapFactory, new Contract(AddressZero, [], accounts[0]), weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		library = platform.library
		adapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(adapter.address)
		genericRouter = await deployGenericRouter(accounts[0], controller)
		await whitelist.connect(accounts[0]).approve(genericRouter.address)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(200) },
			{ token: tokens[2].address, percentage: BigNumber.from(200) },
			{ token: tokens[3].address, percentage: BigNumber.from(50) },
			{ token: tokens[4].address, percentage: BigNumber.from(50) },
			{ token: tokens[5].address, percentage: BigNumber.from(50) },
			{ token: tokens[6].address, percentage: BigNumber.from(50) },
			{ token: tokens[7].address, percentage: BigNumber.from(50) },
			{ token: tokens[8].address, percentage: BigNumber.from(50) },
			{ token: tokens[9].address, percentage: BigNumber.from(50) },
			{ token: tokens[10].address, percentage: BigNumber.from(50) },
			{ token: tokens[11].address, percentage: BigNumber.from(50) },
			{ token: tokens[12].address, percentage: BigNumber.from(50) },
			{ token: tokens[13].address, percentage: BigNumber.from(50) },
			{ token: tokens[14].address, percentage: BigNumber.from(50) },
		] as Position[]
		strategyItems = prepareStrategy(positions, adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(995),
			performanceFee: BigNumber.from(0),
			social: false,
			set: false
		}

		const create2Address = await calculateAddress(
			strategyFactory,
			accounts[1].address,
			name,
			symbol
		)
		const Strategy = await getContractFactory('Strategy')
		strategy = Strategy.attach(create2Address)

		const total = ethers.BigNumber.from('10000000000000000')
		const calls = await prepareDepositMulticall(
			strategy,
			controller,
			genericRouter,
			adapter,
			weth,
			total,
			strategyItems
		)
		const data = await genericRouter.encodeCalls(calls)

		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				strategyItems,
				strategyState,
				genericRouter.address,
				data,
				{ value: total }
			)
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategy.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems, weth)
		//expect(await strategy.getStrategyValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value })
		await weth.connect(accounts[2]).approve(adapter.address, value)
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, tokens[1].address, accounts[2].address, accounts[2].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should fail to deposit: total slipped', async function () {
		const call = await encodeTransferFrom(weth, controller.address, accounts[1].address, BigNumber.from(1))
		const data = await genericRouter.encodeCalls([call])
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, genericRouter.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, data, { value: 1 })
		).to.be.revertedWith('Lost value')
	})

	it('Should fail to rebalance: no reentrancy', async function () {
		//Transfer funds out of strategy during rebalance
		const transferCall = await encodeSettleTransferFrom(genericRouter, tokens[1].address, strategy.address, genericRouter.address)
		//Return funds to strategy during deposit, thus earning strategy tokens for the value increase
		const depositCall = await encodeSettleTransfer(genericRouter, tokens[1].address, strategy.address)
		const depositData = await genericRouter.encodeCalls([depositCall])
		const depositEncoded = await controller.interface.encodeFunctionData('deposit', [
			strategy.address,
			genericRouter.address,
			0,
			DEFAULT_DEPOSIT_SLIPPAGE,
			depositData,
		])
		const reentrancyCall = { target: controller.address, callData: depositEncoded }
		// Note: Normally for this attack to succeed we would also need to include
		// swap calls to properly rebalance the strategy. But that doesn't matter as
		// it should fail before that check is made
		const calls = [transferCall, reentrancyCall]
		const data = await genericRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, genericRouter.address, data)
		).to.be.revertedWith('')
	})

	it('Should fail to rebalance: not balanced', async function () {
		const amount = ethers.BigNumber.from('100000000000') //Some arbitrary amount
		const call = encodeDelegateSwap(
			genericRouter,
			adapter.address,
			amount,
			BigNumber.from(0),
			tokens[1].address,
			weth.address,
			strategy.address,
			strategy.address
		)
		const data = await genericRouter.encodeCalls([call])
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, genericRouter.address, data)
		).to.be.revertedWith('Not balanced')
	})

	it('Should fail to delegateSwap: swap failed', async function () {
		const amount = (await tokens[1].balanceOf(strategy.address)).add(1) // Too much
		const call = encodeDelegateSwap(
			genericRouter,
			adapter.address,
			amount,
			BigNumber.from(0),
			tokens[1].address,
			weth.address,
			strategy.address,
			strategy.address
		)
		const data = await genericRouter.encodeCalls([call])
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, genericRouter.address, data)
		).to.be.revertedWith('') //Revert in calldata
	})

	it('Should fail to rebalance: total slipped', async function () {
		const amount = ethers.BigNumber.from('100000000000000') //Some arbitrary amount
		// Setup rebalance
		const calls = [] as Multicall[]
		const buyLoop = [] as BuyLoop[]
		const tokens = await strategy.items()
		const [actualTotal, estimates] = await oracle.estimateStrategy(strategy.address)
		const total = actualTotal.sub(amount)
		const Erc20Factory = await getContractFactory('ERC20Mock')
		let wethInStrategy = false
		// Sell loop
		for (let i = 0; i < tokens.length; i++) {
			const token = Erc20Factory.attach(tokens[i])
			const estimatedValue = ethers.BigNumber.from(estimates[i])
			const expectedValue = ethers.BigNumber.from(await getExpectedTokenValue(total, token.address, strategy))
			if (token.address.toLowerCase() != weth.address.toLowerCase()) {
				if (estimatedValue.gt(expectedValue)) {
					//console.log('Sell token: ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString(), ' expected value: ', expectedValue.toString())
					const diff = await adapter.spotPrice(estimatedValue.sub(expectedValue), weth.address, token.address)
					const expected = estimatedValue.sub(expectedValue).mul(DEFAULT_DEPOSIT_SLIPPAGE).div(DIVISOR)
					calls.push(
						encodeDelegateSwap(
							genericRouter,
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
		// Take funds from strategy
		calls.push(encodeTransferFrom(weth, strategy.address, accounts[1].address, amount))
		// Buy loop
		for (let i = 0; i < buyLoop.length; i++) {
			const token = Erc20Factory.attach(buyLoop[i].token)
			const estimatedValue = ethers.BigNumber.from(buyLoop[i].estimate)
			if (token.address.toLowerCase() != weth.address.toLowerCase()) {
				if (!wethInStrategy && i == buyLoop.length - 1) {
					//console.log('Buy token:  ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString())
					// The last token must use up the remainder of funds, but since balance is unknown, we call this function which does the final cleanup
					calls.push(
						await encodeSettleSwap(
							genericRouter,
							adapter.address,
							weth.address,
							token.address,
							strategy.address,
							strategy.address
						)
					)
				} else {
					const expectedValue = ethers.BigNumber.from(
						await getExpectedTokenValue(total, token.address, strategy)
					)
					if (estimatedValue.lt(expectedValue)) {
						//console.log('Buy token:  ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString(), ' expected value: ', expectedValue.toString())
						const diff = expectedValue.sub(estimatedValue)
						const expected = BigNumber.from(await adapter.spotPrice(diff, weth.address, token.address)).mul(DEFAULT_DEPOSIT_SLIPPAGE).div(DIVISOR)
						calls.push(
							await encodeDelegateSwap(
								genericRouter,
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

		const data = await genericRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, genericRouter.address, data)
		).to.be.revertedWith('Too much slippage')
	})

	it('Should rebalance strategy with multicall', async function () {
		// Multicall gets initial tokens from uniswap
		const calls = await prepareRebalanceMulticall(
			strategy,
			genericRouter,
			adapter,
			oracle,
			weth
		)
		const data = await genericRouter.encodeCalls(calls)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, genericRouter.address, data)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to withdraw: too much slippage', async function () {
		const amount = await strategy.balanceOf(accounts[1].address)
		const calls = (await Promise.all(tokens.map(async (token) => {
			const balance = await token.balanceOf(strategy.address)
			if (balance.gt(0)) {
				return encodeTransferFrom(token, strategy.address, accounts[1].address, balance)
			} else {
				return null
			}
		}))).filter(call => call)
		calls.pop() // Remove a token transfer to leave some funds in Strategy (otherwise we encounter a sutraction overlow since more funds are removed than weth owed)
		const data = await genericRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).withdrawWETH(strategy.address, genericRouter.address, amount, DEFAULT_DEPOSIT_SLIPPAGE, data)
		).to.be.revertedWith('Too much slippage')
	})

	it('Should fail to call delegateSwap: only internal', async function () {
		await expect(
			genericRouter.delegateSwap(
				adapter.address,
				1,
				0,
				tokens[1].address,
				weth.address,
				strategy.address,
				strategy.address
			)
		).to.be.revertedWith('Only internal')
	})

	it('Should fail to call settleSwap: only internal', async function () {
		await expect(
			genericRouter.settleSwap(
				adapter.address,
				tokens[1].address,
				weth.address,
				strategy.address,
				accounts[1].address
			)
		).to.be.revertedWith('Only internal')
	})

	it('Should succeed in calling settleSwap, settleTransfer and settleTransferFrom when there is no balance', async function () {
		const amount = WeiPerEther
		// Transfer weth to router so that it may be transferred out
		await weth.deposit({value: amount})
		await weth.transfer(genericRouter.address, amount)
		// Setup calls
		const calls = await prepareDepositMulticall(
			strategy,
			controller,
			genericRouter,
			adapter,
			weth,
			amount,
			strategyItems
		)
		calls.push(
			await encodeSettleSwap(
				genericRouter,
				adapter.address,
				weth.address,
				tokens[1].address,
				controller.address,
				accounts[1].address
			)
		)
		calls.push(await encodeSettleTransfer(genericRouter, weth.address, accounts[1].address)) // When there is balance
		calls.push(await encodeSettleTransfer(genericRouter, weth.address, accounts[1].address)) // When there isn't balance
		calls.push(await encodeSettleTransferFrom(genericRouter, weth.address, controller.address, accounts[1].address))
		const data = await genericRouter.encodeCalls(calls)
		await controller.connect(accounts[1]).deposit(strategy.address, genericRouter.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, data, { value: amount })
	})

	it('Should fail to deposit: calling settleTransferFrom without approval', async function () {
		const amount = WeiPerEther
		const calls = await prepareDepositMulticall(
			strategy,
			controller,
			genericRouter,
			adapter,
			weth,
			amount,
			strategyItems
		)
		calls.push(
			await encodeSettleTransferFrom(genericRouter, tokens[1].address, strategy.address, accounts[1].address)
		)
		const data = await genericRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, genericRouter.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, data, { value: amount })
		).to.be.revertedWith('')
	})

	it('Should restructure to just token', async function () {
		const positions = [{ token: tokens[1].address, percentage: BigNumber.from(1000) }] as Position[]
		const newItems = prepareStrategy(positions, adapter.address)
		await controller.connect(accounts[1]).restructure(strategy.address, newItems)
	})

	it('Should fail to restructure: too much slippage', async function () {
		const currentItems = await strategy.items()
		const calls = [] as Multicall[]
		const Erc20Factory = await getContractFactory('ERC20Mock')
		for (let i = 0; i < currentItems.length; i++) {
			if (currentItems[i] !== tokens[1].address && currentItems[i] !== weth.address) {
				const token = Erc20Factory.attach(currentItems[i])
				const amount = await token.balanceOf(strategy.address)
				calls.push(
					encodeDelegateSwap(
						genericRouter,
						adapter.address,
						amount,
						BigNumber.from(0),
						currentItems[i],
						weth.address,
						strategy.address,
						genericRouter.address
					)
				)
			}
		}
		calls.push(encodeTransfer(weth, accounts[1].address, WeiPerEther.div(100)))
		calls.push(encodeSettleSwap(
			genericRouter,
			adapter.address,
			weth.address,
			tokens[1].address,
			genericRouter.address,
			strategy.address
		))
		const data = await genericRouter.encodeCalls(calls)

		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, genericRouter.address, data)
			).to.be.revertedWith('Too much slippage')
	})

	it('Should fail to restructure: out of balance', async function () {
		const currentItems = await strategy.items()
		const calls = [] as Multicall[]
		const Erc20Factory = await getContractFactory('ERC20Mock')
		for (let i = 0; i < currentItems.length; i++) {
			if (currentItems[i] !== tokens[1].address && currentItems[i] !== weth.address) {
				const token = Erc20Factory.attach(currentItems[i])
				const amount = await token.balanceOf(strategy.address)
				calls.push(
					encodeDelegateSwap(
						genericRouter,
						adapter.address,
						amount,
						BigNumber.from(0),
						currentItems[i],
						weth.address,
						strategy.address,
						strategy.address
					)
				)
			}
		}
		const data = await genericRouter.encodeCalls(calls)

		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, genericRouter.address, data)
			).to.be.revertedWith('Not balanced')
	})

	it('Should finalize structure', async function () {
		const currentItems = await strategy.items()
		const calls = [] as Multicall[]
		const Erc20Factory = await getContractFactory('ERC20Mock')
		for (let i = 0; i < currentItems.length; i++) {
			if (currentItems[i] !== tokens[1].address && currentItems[i] !== weth.address) {
				const token = Erc20Factory.attach(currentItems[i])
				const amount = await token.balanceOf(strategy.address)
				calls.push(
					encodeDelegateSwap(
						genericRouter,
						adapter.address,
						amount,
						BigNumber.from(0),
						currentItems[i],
						weth.address,
						strategy.address,
						genericRouter.address
					)
				)
			}
		}
		calls.push(encodeSettleSwap(
			genericRouter,
			adapter.address,
			weth.address,
			tokens[1].address,
			genericRouter.address,
			strategy.address
		))

		const data = await genericRouter.encodeCalls(calls)

		await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, genericRouter.address, data)
	})

	it('Should fail to deposit: out of balance', async function () {
		const amount = WeiPerEther
		const calls = []
		calls.push(
			encodeSettleTransferFrom(genericRouter, weth.address, controller.address, genericRouter.address)
		) //Transfer from controller to router
		calls.push(encodeSettleTransfer(genericRouter, weth.address, strategy.address)) //Transfer to strategy

		const data = await genericRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, genericRouter.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, data, { value: amount })
		).to.be.revertedWith('Lost balance')
	})

	it('Should fail to call router directly', async function () {
		const calls = []
		calls.push(encodeSettleTransferFrom(genericRouter, weth.address, strategy.address, accounts[1].address)) //Transfer from strategy to account
		const data = await genericRouter.encodeCalls(calls)
		await expect(genericRouter.connect(accounts[1]).deposit(strategy.address, data)).to.be.revertedWith(
			'Only controller'
		)
	})


})
