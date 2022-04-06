import { expect } from 'chai'
import { ethers } from 'hardhat'
import { deployUniswapV2, deployTokens, deployPlatform, deployUniswapV2Adapter, deployMulticallRouter } from '../lib/deploy'
import { Contract, BigNumber } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { StrategyItem, InitialState, prepareStrategy, prepareDepositMulticall, calculateAddress, encodeSettleSwap } from '../lib/encode'
import { DEFAULT_DEPOSIT_SLIPPAGE } from '../lib/constants'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 3

describe('Reentrancy    ', function () {
	let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		multicallRouter: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		library: Contract,
		adapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract
	before('Setup Uniswap, Factory, MulticallRouter', async function () {
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
		multicallRouter = await deployMulticallRouter(accounts[0], controller)
		await whitelist.connect(accounts[0]).approve(multicallRouter.address)
	})
	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) },
		]
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
		strategy = await Strategy.attach(create2Address)

		const total = ethers.BigNumber.from('10000000000000000')
		const calls = await prepareDepositMulticall(
			strategy,
			controller,
			multicallRouter,
			adapter,
			weth,
			total,
			strategyItems
		)
		const data = await multicallRouter.encodeCalls(calls)

		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				strategyItems,
				strategyState,
				multicallRouter.address,
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

	it('fail to reenter deposit fn', async function () {
		const total = ethers.BigNumber.from('10000000000000000')
		const calls = []
		const depositCalls = await prepareDepositMulticall(
			strategy,
			controller,
			multicallRouter,
			adapter,
			weth,
			total,
			strategyItems
		)
		calls.push(...depositCalls)
		let secondDeposit = await multicallRouter.encodeCalls(calls)
		let depositCalldata = controller.interface.encodeFunctionData('deposit', [
			strategy.address,
			multicallRouter.address,
			0,
			DEFAULT_DEPOSIT_SLIPPAGE,
			secondDeposit,
		])
		calls.push({ target: controller.address, callData: depositCalldata, value: 0 })
		let data = await multicallRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, multicallRouter.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, data, { value: total })
		).to.be.revertedWith('')
	})

	it('fail to siphon tokens with settle swap', async function () {
		const total = ethers.BigNumber.from('10000000000000000')
		const token1Balance = await tokens[1].balanceOf(accounts[1].address)
		const token2Balance = await tokens[2].balanceOf(accounts[1].address)
		const calls = []
		const depositCalls = await prepareDepositMulticall(
			strategy,
			controller,
			multicallRouter,
			adapter,
			weth,
			total,
			strategyItems
		)
		calls.push(...depositCalls)

		calls.push(
			encodeSettleSwap(
				multicallRouter,
				adapter.address,
				tokens[2].address,
				tokens[1].address,
				strategy.address,
				accounts[1].address
			)
		)

		let data = await multicallRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, multicallRouter.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, data, { value: total })
		).to.be.revertedWith('')

		// Remove last call
		calls.pop()
		data = await multicallRouter.encodeCalls(calls)

		// Deposit should work now
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, multicallRouter.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, data, { value: total })
		const receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())

		//await displayBalances(wrapper, strategyItems, weth)
		expect(await tokens[1].balanceOf(accounts[1].address)).to.equal(token1Balance)
		expect(await tokens[2].balanceOf(accounts[1].address)).to.equal(token2Balance)
	})
})
