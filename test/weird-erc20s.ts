import { expect } from 'chai'
import { solidity } from 'ethereum-waffle'
const chai = require('chai')
chai.use(solidity)

const bn = require('bignumber.js')
const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners} = ethers
const { WeiPerEther } = constants
import { StrategyBuilder } from '../lib/encode'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployLoopRouter } from '../lib/deploy'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Event, Contract} from 'ethers'
const NUM_TOKENS = 10
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH: Contract

export enum TokenTypes {
	Weth = 'Weth',
	ApprovalRaceToken = 'ApprovalRaceToken',
	HighDecimalToken = 'HighDecimalToken',
	LowDecimalToken = 'LowDecimalToken',
	NoRevertToken = 'NoRevertToken',
	RevertToZeroToken = 'RevertToZeroToken',
	RevertZeroToken = 'RevertZeroToken',
	TransferFeeToken = 'TransferFeeToken',
	Uint96Token = 'Uint96Token',
}

export class WeirdToken {
	public contract: Contract;
	public tokenType: TokenTypes;
	constructor(contract: Contract, tokenType: TokenTypes) {
		this.contract = contract;
		this.tokenType = tokenType;
	}
	print() {
		console.log('WeirdErc20: ')
		console.log('  Token Type: ', this.tokenType)
		console.log('  Address: ', this.contract.address)
	}
}

describe('Weird ERC20s', function () {
	let tokens: Contract[],
		weirdTokens: WeirdToken[],
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		router: Contract,
		adapter: Contract,
		strategy: Contract,
		strategyTokens: string[],
		strategyPercentages: BigNumber[],
		strategyAdapters: string[],
		wrapper: Contract


	before('Setup Uniswap + Factory', async function () {
		const defaultSupply = WeiPerEther.mul(10000)
		accounts = await getSigners()
		tokens = await deployTokens(accounts[10], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		const ApprovalRaceToken = await getContractFactory('ApprovalRaceToken')
		const approvalRaceToken = await ApprovalRaceToken.connect(accounts[10]).deploy(defaultSupply)
		await approvalRaceToken.deployed()
		const HighDecimalToken = await getContractFactory('HighDecimalToken')
		const highDecimalToken = await HighDecimalToken.connect(accounts[10]).deploy(defaultSupply)
		await highDecimalToken.deployed()
		const LowDecimalToken = await getContractFactory('LowDecimalToken')
		const lowDecimalToken = await LowDecimalToken.connect(accounts[10]).deploy(defaultSupply)
		await lowDecimalToken.deployed()
		const RevertToZeroToken = await getContractFactory('RevertToZeroToken')
		const revertToZeroToken = await RevertToZeroToken.connect(accounts[10]).deploy(defaultSupply)
		await revertToZeroToken.deployed()
		const RevertZeroToken = await getContractFactory('RevertZeroToken')
		const revertZeroToken = await RevertZeroToken.connect(accounts[10]).deploy(defaultSupply)
		const TransferFeeToken = await getContractFactory('TransferFeeToken')
		const transferFeeToken = await TransferFeeToken.connect(accounts[10]).deploy(defaultSupply, 10)
		await transferFeeToken.deployed()
		const Uint96Token = await getContractFactory('Uint96Token')
		const uint96Token = await Uint96Token.connect(accounts[10]).deploy(defaultSupply)
		await uint96Token.deployed()

		const NoRevertToken = await getContractFactory('NoRevertToken')
		const noRevertToken = await NoRevertToken.connect(accounts[10]).deploy(defaultSupply)
		await noRevertToken.deployed()
		// console.log('no revert token balance', await noRevertToken.balanceOf(accounts[0].address))
		weirdTokens = []
		WETH = tokens[0]
		weirdTokens.push(new WeirdToken(WETH, TokenTypes.Weth))
		weirdTokens.push(new WeirdToken(approvalRaceToken, TokenTypes.ApprovalRaceToken))
		weirdTokens.push(new WeirdToken(highDecimalToken, TokenTypes.HighDecimalToken))
		weirdTokens.push(new WeirdToken(lowDecimalToken, TokenTypes.LowDecimalToken))
		weirdTokens.push(new WeirdToken(revertToZeroToken, TokenTypes.RevertToZeroToken))
		weirdTokens.push(new WeirdToken(revertZeroToken, TokenTypes.RevertZeroToken))
		weirdTokens.push(new WeirdToken(transferFeeToken, TokenTypes.TransferFeeToken))
		weirdTokens.push(new WeirdToken(uint96Token, TokenTypes.Uint96Token))
		// TODO: revert ds-math-sub-underflow when deploying NoRevertToken to un
		// weirdTokens.push(new WeirdToken(noRevertToken, TokenTypes.NoRevertToken))
		weirdTokens.map((t) => t.print())

		const weirdTokenContracts = weirdTokens.map((token) => token.contract)

		uniswapFactory = await deployUniswapV2(accounts[10], weirdTokenContracts)
		const p = await deployPlatform(accounts[10], uniswapFactory, WETH)
		;[strategyFactory, controller, oracle, whitelist] = [p.strategyFactory, p.controller, p.oracle, p.whitelist]
		adapter = await deployUniswapV2Adapter(accounts[10], uniswapFactory, WETH)
		router = await deployLoopRouter(accounts[10], controller, adapter, WETH)
		await whitelist.connect(accounts[10]).approve(router.address)

		// remove weth from weird token list
		weirdTokens.shift()
		expect(weirdTokenContracts.length).to.eq(weirdTokens.length + 1)
	})

	it('Deploy strategy with ApprovalRaceToken in Strategy', async function () {
		expect(weirdTokens[0].tokenType).to.eq(TokenTypes.ApprovalRaceToken)
		const positions = [
			{ token: WETH.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[0].contract.address, percentage: BigNumber.from(500) },
		]

		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]

		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy',
			'TEST',
			strategyTokens,
			strategyPercentages,
			true,
			50, // 5% fee
			REBALANCE_THRESHOLD,
			SLIPPAGE,
			TIMELOCK,
			router.address,
			data,
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should rebalance ApprovalRaceToken strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await WETH.connect(accounts[2]).deposit({ value: value.mul(2) })
		await WETH.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, weirdTokens[0].contract.address, accounts[2].address, accounts[2].address, '0x', '0x')
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => bn(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])

		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
	})

	it('Deploy strategy with HighDecimals token', async function () {
		expect(weirdTokens[1].tokenType).to.eq(TokenTypes.HighDecimalToken)
		const positions = [
			{ token: WETH.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[1].contract.address, percentage: BigNumber.from(500) },
		]

		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]

		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy',
			'TEST',
			strategyTokens,
			strategyPercentages,
			true,
			50, // 5% fee
			REBALANCE_THRESHOLD,
			SLIPPAGE,
			TIMELOCK,
			router.address,
			data,
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})
	it('Should rebalance HighDecimals strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await WETH.connect(accounts[2]).deposit({ value: value.mul(2) })
		await WETH.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, weirdTokens[1].contract.address, accounts[2].address, accounts[2].address, '0x', '0x')
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => bn(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
	})

	it('Deploy strategy with LowDecimals token', async function () {
		expect(weirdTokens[2].tokenType).to.eq(TokenTypes.LowDecimalToken)
		const positions = [
			{ token: WETH.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[2].contract.address, percentage: BigNumber.from(500) },
		]

		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]

		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy',
			'TEST',
			strategyTokens,
			strategyPercentages,
			true,
			50, // 5% fee
			REBALANCE_THRESHOLD,
			SLIPPAGE,
			TIMELOCK,
			router.address,
			data,
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})
	it('Should rebalance LowDecimals strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await WETH.connect(accounts[2]).deposit({ value: value.mul(2) })
		await WETH.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, weirdTokens[2].contract.address, accounts[2].address, accounts[2].address, '0x', '0x')
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => bn(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
	})

	it('Deploy strategy with RevertToZero token', async function () {
		expect(weirdTokens[3].tokenType).to.eq(TokenTypes.RevertToZeroToken)
		const positions = [
			{ token: WETH.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[3].contract.address, percentage: BigNumber.from(500) },
		]

		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]

		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy',
			'TEST',
			strategyTokens,
			strategyPercentages,
			true,
			50, // 5% fee
			REBALANCE_THRESHOLD,
			SLIPPAGE,
			TIMELOCK,
			router.address,
			data,
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})
	it('Should rebalance RevertToZero strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await WETH.connect(accounts[2]).deposit({ value: value.mul(2) })
		await WETH.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, weirdTokens[3].contract.address, accounts[2].address, accounts[2].address, '0x', '0x')
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => bn(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
	})

	it('Deploy strategy with RevertZero token', async function () {
		expect(weirdTokens[4].tokenType).to.eq(TokenTypes.RevertZeroToken)
		const positions = [
			{ token: WETH.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[4].contract.address, percentage: BigNumber.from(500) },
		]

		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]

		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy',
			'TEST',
			strategyTokens,
			strategyPercentages,
			true,
			50, // 5% fee
			REBALANCE_THRESHOLD,
			SLIPPAGE,
			TIMELOCK,
			router.address,
			data,
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})
	it('Should rebalance RevertZero strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await WETH.connect(accounts[2]).deposit({ value: value.mul(2) })
		await WETH.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, weirdTokens[4].contract.address, accounts[2].address, accounts[2].address, '0x', '0x')
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => bn(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
	})

	it('Deploy strategy with TransferFee token', async function () {
		expect(weirdTokens[5].tokenType).to.eq(TokenTypes.TransferFeeToken)
		const positions = [
			{ token: WETH.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[5].contract.address, percentage: BigNumber.from(500) },
		]

		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]

		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy',
			'TEST',
			strategyTokens,
			strategyPercentages,
			true,
			50, // 5% fee
			REBALANCE_THRESHOLD,
			SLIPPAGE,
			TIMELOCK,
			router.address,
			data,
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})
	it('Should rebalance TransferFeeToken strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await WETH.connect(accounts[2]).deposit({ value: value.mul(2) })
		await WETH.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, weirdTokens[5].contract.address, accounts[2].address, accounts[2].address, '0x', '0x')
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => bn(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
	})

	it('Deploy strategy with Uint96 token', async function () {
		expect(weirdTokens[6].tokenType).to.eq(TokenTypes.Uint96Token)
		const positions = [
			{ token: WETH.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[6].contract.address, percentage: BigNumber.from(500) },
		]

		const s = new StrategyBuilder(positions, adapter.address)
		;[strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]

		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy',
			'TEST',
			strategyTokens,
			strategyPercentages,
			true,
			50, // 5% fee
			REBALANCE_THRESHOLD,
			SLIPPAGE,
			TIMELOCK,
			router.address,
			data,
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})
	it('Should rebalance Uint96Token strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await WETH.connect(accounts[2]).deposit({ value: value.mul(2) })
		await WETH.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, WETH.address, weirdTokens[6].contract.address, accounts[2].address, accounts[2].address, '0x', '0x')
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => bn(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
	})

	// it('Deploy strategy with NoRevert token', async function () {
	// 	const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
	// 	let tx = await strategyFactory.connect(accounts[1]).createStrategy(
	// 		accounts[1].address,
	// 		'Test Strategy',
	// 		'TEST',
	// 		strategyTokens,
	// 		strategyPercentages,
	// 		true,
	// 		50, // 5% fee
	// 		REBALANCE_THRESHOLD,
	// 		SLIPPAGE,
	// 		TIMELOCK,
	// 		router.address,
	// 		data,
	// 		{ value: ethers.BigNumber.from('10000000000000000') }
	// 	)
	// 	let receipt = await tx.wait()

	// 	const strategyAddress = receipt.events.find((ev) => ev.event === 'NewStrategy').args.strategy
	// 	const Strategy = await getContractFactory('Strategy')
	// 	strategy = await Strategy.attach(strategyAddress)

	// 	const LibraryWrapper = await getContractFactory('LibraryWrapper')
	// 	wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
	// 	await wrapper.deployed()

	// 	expect(await wrapper.isBalanced()).to.equal(true)
	// })
	// it('Should rebalance NoRevertToken strategy', async function () {
	// 	// Other account purchases from uniswap (puts strategy out of balance)
	// 	const value = WeiPerEther.mul(50)
	// 	await WETH.connect(accounts[2]).deposit({ value: value.mul(2) })
	// 	await WETH.connect(accounts[2]).approve(adapter.address, value.mul(2))
	// 	await adapter
	// 		.connect(accounts[2])
	// 		.swap(value, 0, WETH.address, weirdTokens[8].address, accounts[2].address, accounts[2].address, '0x', '0x')
	// 	expect(await wrapper.isBalanced()).to.equal(false)

	// 	// Rebalance
	// 	const estimates = await Promise.all(
	// 		strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
	// 	)
	// 	const total = estimates.reduce((total, value) => bn(total.toString()).plus(value)).toString()
	// 	const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
	// 	await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
	// })
})
