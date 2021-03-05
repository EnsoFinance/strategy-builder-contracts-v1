const { expect } = require('chai')
const { ethers } = require('hardhat')
const { displayBalances } = require('./helpers/logging.js')
const {
	deployUniswap,
	deployTokens,
	deployPlatform,
	deployUniswapAdapter,
	deployGenericRouter,
	deployDsProxyFactory,
	deployDsProxy,
} = require('./helpers/deploy.js')
const {
	preparePortfolio,
	prepareDepositMulticall,
	calculateAddress,
	prepareUniswapSwap,
	getExpectedTokenValue,
	getRebalanceRange,
	encodeTransferFrom,
	encodeEthTransfer,
	encodeDelegateSwap,
	encodeSettleSwap,
} = require('./helpers/encode.js')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 3
let WETH
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 1209600 // Two weeks

describe('Reentrancy    ', function () {
	let tokens,
		accounts,
		uniswapFactory,
		portfolioFactory,
		controller,
		oracle,
		whitelist,
		genericRouter,
		adapter,
		portfolio,
		portfolioTokens,
		portfolioPercentages,
		portfolioAdapters,
		wrapper,
		dsProxyFactory,
		dsProxy

	before('Setup Uniswap, Factory, GenericRouter, DSProxy', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		uniswapFactory = await deployUniswap(accounts[0], tokens)
		adapter = await deployUniswapAdapter(accounts[0], uniswapFactory, WETH)
		;[portfolioFactory, controller, oracle, whitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH)
		genericRouter = await deployGenericRouter(accounts[0], controller, WETH)
		await whitelist.connect(accounts[0]).approve(genericRouter.address)
		dsProxyFactory = await deployDsProxyFactory(accounts[0])
		dsProxy = await deployDsProxy(dsProxyFactory, accounts[1])
	})
	it('Should deploy portfolio', async function () {
		const name = 'Test Portfolio'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: 500 },
			{ token: tokens[2].address, percentage: 500 },
		]
		;[portfolioTokens, portfolioPercentages] = preparePortfolio(positions, adapter.address)

		const create2Address = await calculateAddress(
			portfolioFactory,
			accounts[1].address,
			name,
			symbol,
			portfolioTokens,
			portfolioPercentages
		)
		const Portfolio = await getContractFactory('Portfolio')
		portfolio = await Portfolio.attach(create2Address)

		const total = ethers.BigNumber.from('10000000000000000')
		const calls = await prepareDepositMulticall(
			portfolio,
			controller,
			genericRouter,
			adapter,
			uniswapFactory,
			WETH,
			total,
			portfolioTokens,
			portfolioPercentages
		)
		const data = await genericRouter.encodeCalls(calls)

		let tx = await portfolioFactory
			.connect(accounts[1])
			.createPortfolio(
				name,
				symbol,
				portfolioTokens,
				portfolioPercentages,
				false,
				0,
				REBALANCE_THRESHOLD,
				SLIPPAGE,
				TIMELOCK,
				genericRouter.address,
				data,
				{ value: total }
			)
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, portfolio.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, portfolioTokens, WETH)
		//expect(await portfolio.getPortfolioValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(50)
		await adapter
			.connect(accounts[2])
			.swap(value, 0, AddressZero, tokens[1].address, accounts[2].address, accounts[2].address, [], [], {
				value: value,
			})
		await displayBalances(wrapper, portfolioTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('fail to reenter deposit fn', async function () {
		const total = ethers.BigNumber.from('10000000000000000')
		const calls = []
		const depositCalls = await prepareDepositMulticall(
			portfolio,
			controller,
			genericRouter,
			adapter,
			uniswapFactory,
			WETH,
			total,
			portfolioTokens,
			portfolioPercentages
		)
		calls.push(...depositCalls)
		let secondDeposit = await genericRouter.encodeCalls(calls)
		let depositCalldata = await controller.interface.encodeFunctionData('deposit', [
			portfolio.address,
			genericRouter.address,
			secondDeposit,
		])
		calls.push({ target: controller.address, callData: depositCalldata, value: 0 })
		let data = await genericRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).deposit(portfolio.address, genericRouter.address, data, { value: total })
		).to.be.revertedWith()
	})

	it('fail to siphon tokens with settle swap', async function () {
		const total = ethers.BigNumber.from('10000000000000000')
		const token1Balance = await tokens[1].balanceOf(accounts[1].address)
		const token2Balance = await tokens[2].balanceOf(accounts[1].address)
		const calls = []
		const depositCalls = await prepareDepositMulticall(
			portfolio,
			controller,
			genericRouter,
			adapter,
			uniswapFactory,
			WETH,
			total,
			portfolioTokens,
			portfolioPercentages
		)
		calls.push(...depositCalls)

		calls.push(
			await encodeSettleSwap(
				genericRouter,
				adapter.address,
				tokens[2].address,
				tokens[1].address,
				portfolio.address,
				accounts[1].address
			)
		)

		let data = await genericRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).deposit(portfolio.address, genericRouter.address, data, { value: total })
		).to.be.revertedWith()

		// Remove last call
		calls.pop()
		data = await genericRouter.encodeCalls(calls)

		// Deposit should work now
		const tx = await controller
			.connect(accounts[1])
			.deposit(portfolio.address, genericRouter.address, data, { value: total })
		receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())

		await displayBalances(wrapper, portfolioTokens, WETH)
		expect(await tokens[1].balanceOf(accounts[1].address)).to.equal(token1Balance)
		expect(await tokens[2].balanceOf(accounts[1].address)).to.equal(token2Balance)
	})
})
