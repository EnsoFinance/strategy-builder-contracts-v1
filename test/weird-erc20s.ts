import { expect } from 'chai'
import { solidity } from 'ethereum-waffle'
const chai = require('chai')
chai.use(solidity)

const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners} = ethers
const { AddressZero, WeiPerEther } = constants
import { prepareStrategy, StrategyItem, InitialState } from '../lib/encode'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployLoopRouter } from '../lib/deploy'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Event, Contract} from 'ethers'

const NUM_TOKENS = 10
const STRATEGY_STATE: InitialState = {
	timelock: BigNumber.from(60),
	rebalanceThreshold: BigNumber.from(10),
	rebalanceSlippage: BigNumber.from(997),
	restructureSlippage: BigNumber.from(995),
	performanceFee: BigNumber.from(50),
	social: true,
	set: false
}

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
		weth: Contract,
		weirdTokens: WeirdToken[],
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		library: Contract,
		router: Contract,
		adapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
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
		weth = tokens[0]
		weirdTokens.push(new WeirdToken(weth, TokenTypes.Weth))
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
		const platform = await deployPlatform(accounts[10], uniswapFactory, new Contract(AddressZero, [], accounts[10]), weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		library = platform.library
		adapter = await deployUniswapV2Adapter(accounts[10], uniswapFactory, weth)
		await whitelist.connect(accounts[10]).approve(adapter.address)
		router = await deployLoopRouter(accounts[10], controller, library)
		await whitelist.connect(accounts[10]).approve(router.address)

		// remove weth from weird token list
		weirdTokens.shift()
		expect(weirdTokenContracts.length).to.eq(weirdTokens.length + 1)
	})

	it('Deploy strategy with ApprovalRaceToken in Strategy', async function () {
		expect(weirdTokens[0].tokenType).to.eq(TokenTypes.ApprovalRaceToken)
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[0].contract.address, percentage: BigNumber.from(500) },
		]

		strategyItems = prepareStrategy(positions, adapter.address)

		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy',
			'TEST',
			strategyItems,
			STRATEGY_STATE,
			router.address,
			'0x',
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should rebalance ApprovalRaceToken strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value.mul(2) })
		await weth.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, weirdTokens[0].contract.address, accounts[2].address, accounts[2].address)
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
	})

	it('Deploy strategy with HighDecimals token', async function () {
		expect(weirdTokens[1].tokenType).to.eq(TokenTypes.HighDecimalToken)
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[1].contract.address, percentage: BigNumber.from(500) },
		]

		strategyItems = prepareStrategy(positions, adapter.address)

		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy 2',
			'TEST2',
			strategyItems,
			STRATEGY_STATE,
			router.address,
			'0x',
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})
	it('Should rebalance HighDecimals strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value.mul(2) })
		await weth.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, weirdTokens[1].contract.address, accounts[2].address, accounts[2].address)
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
	})

	it('Deploy strategy with LowDecimals token', async function () {
		expect(weirdTokens[2].tokenType).to.eq(TokenTypes.LowDecimalToken)
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[2].contract.address, percentage: BigNumber.from(500) },
		]

		strategyItems = prepareStrategy(positions, adapter.address)

		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy 3',
			'TEST3',
			strategyItems,
			STRATEGY_STATE,
			router.address,
			'0x',
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})
	it('Should rebalance LowDecimals strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value.mul(2) })
		await weth.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, weirdTokens[2].contract.address, accounts[2].address, accounts[2].address)
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
	})

	it('Deploy strategy with RevertToZero token', async function () {
		expect(weirdTokens[3].tokenType).to.eq(TokenTypes.RevertToZeroToken)
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[3].contract.address, percentage: BigNumber.from(500) },
		]

		strategyItems = prepareStrategy(positions, adapter.address)

		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy 4',
			'TEST4',
			strategyItems,
			STRATEGY_STATE,
			router.address,
			'0x',
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})
	it('Should rebalance RevertToZero strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value.mul(2) })
		await weth.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, weirdTokens[3].contract.address, accounts[2].address, accounts[2].address)
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
	})

	it('Deploy strategy with RevertZero token', async function () {
		expect(weirdTokens[4].tokenType).to.eq(TokenTypes.RevertZeroToken)
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[4].contract.address, percentage: BigNumber.from(500) },
		]

		strategyItems = prepareStrategy(positions, adapter.address)

		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy 5',
			'TEST5',
			strategyItems,
			STRATEGY_STATE,
			router.address,
			'0x',
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})
	it('Should rebalance RevertZero strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value.mul(2) })
		await weth.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, weirdTokens[4].contract.address, accounts[2].address, accounts[2].address)
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
	})

	it('Deploy strategy with TransferFee token', async function () {
		expect(weirdTokens[5].tokenType).to.eq(TokenTypes.TransferFeeToken)
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[5].contract.address, percentage: BigNumber.from(500) },
		]

		strategyItems = prepareStrategy(positions, adapter.address)

		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy 6',
			'TEST6',
			strategyItems,
			STRATEGY_STATE,
			router.address,
			'0x',
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})
	it('Should rebalance TransferFeeToken strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value.mul(2) })
		await weth.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, weirdTokens[5].contract.address, accounts[2].address, accounts[2].address)
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
	})

	it('Deploy strategy with Uint96 token', async function () {
		expect(weirdTokens[6].tokenType).to.eq(TokenTypes.Uint96Token)
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(500) },
			{ token: weirdTokens[6].contract.address, percentage: BigNumber.from(500) },
		]

		strategyItems = prepareStrategy(positions, adapter.address)

		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy 7',
			'TEST7',
			strategyItems,
			STRATEGY_STATE,
			router.address,
			'0x',
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		expect(await wrapper.isBalanced()).to.equal(true)
	})
	it('Should rebalance Uint96Token strategy', async function () {
		// Other account purchases from uniswap (puts strategy out of balance)
		const value = WeiPerEther.mul(50)
		await weth.connect(accounts[2]).deposit({ value: value.mul(2) })
		await weth.connect(accounts[2]).approve(adapter.address, value.mul(2))
		await adapter
			.connect(accounts[2])
			.swap(value, 0, weth.address, weirdTokens[6].contract.address, accounts[2].address, accounts[2].address)
		expect(await wrapper.isBalanced()).to.equal(false)

		// Rebalance
		await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
	})

	// it('Deploy strategy with NoRevert token', async function () {
	// 	let tx = await strategyFactory.connect(accounts[1]).createStrategy(
	// 		accounts[1].address,
	// 		'Test Strategy 8',
	// 		'TEST 8',
	// 		strategyItems,
	// 		STRATEGY_STATE,
	// 		router.address,
	// 		'0x',
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
	// 	await weth.connect(accounts[2]).deposit({ value: value.mul(2) })
	// 	await weth.connect(accounts[2]).approve(adapter.address, value.mul(2))
	// 	await adapter
	// 		.connect(accounts[2])
	// 		.swap(value, 0, weth.address, weirdTokens[8].address, accounts[2].address, accounts[2].address)
	// 	expect(await wrapper.isBalanced()).to.equal(false)

	// 	// Rebalance
	// 	await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
	// })
})
