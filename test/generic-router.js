const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
const { expect } = require('chai')
const { ethers } = require('hardhat')
//const { displayBalances } = require('./helpers/logging.js')
const {
	deployUniswap,
	deployTokens,
	deployPlatform,
	deployUniswapAdapter,
	deployGenericRouter,
} = require('./helpers/deploy.js')
const {
	prepareStrategy,
	prepareRebalanceMulticall,
	prepareDepositMulticall,
	prepareUniswapSwap,
	calculateAddress,
	getRebalanceRange,
	getExpectedTokenValue,
	encodeSettleSwap,
	encodeSettleTransfer,
	encodeTransferFrom,
	encodeDelegateSwap,
} = require('./helpers/encode.js')
const { FEE, DIVISOR } = require('./helpers/utils.js')
const { constants, getContractFactory, getContractAt, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 15
let WETH
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 1209600 // Two weeks

describe('GenericRouter', function () {
	let tokens,
		accounts,
		uniswapFactory,
		strategyFactory,
		controller,
		oracle,
		whitelist,
		genericRouter,
		adapter,
		strategy,
		strategyTokens,
		strategyPercentages,
		wrapper

	before('Setup Uniswap, Factory, GenericRouter', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		uniswapFactory = await deployUniswap(accounts[0], tokens)
		adapter = await deployUniswapAdapter(accounts[0], uniswapFactory, WETH)
		;[strategyFactory, controller, oracle, whitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH)
		genericRouter = await deployGenericRouter(accounts[0], controller, WETH)
		await whitelist.connect(accounts[0]).approve(genericRouter.address)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens[1].address, percentage: 200 },
			{ token: tokens[2].address, percentage: 200 },
			{ token: tokens[3].address, percentage: 50 },
			{ token: tokens[4].address, percentage: 50 },
			{ token: tokens[5].address, percentage: 50 },
			{ token: tokens[6].address, percentage: 50 },
			{ token: tokens[7].address, percentage: 50 },
			{ token: tokens[8].address, percentage: 50 },
			{ token: tokens[9].address, percentage: 50 },
			{ token: tokens[10].address, percentage: 50 },
			{ token: tokens[11].address, percentage: 50 },
			{ token: tokens[12].address, percentage: 50 },
			{ token: tokens[13].address, percentage: 50 },
			{ token: tokens[14].address, percentage: 50 },
		]
		;[strategyTokens, strategyPercentages] = prepareStrategy(positions, adapter.address)

		const create2Address = await calculateAddress(
			strategyFactory,
			accounts[1].address,
			name,
			symbol,
			strategyTokens,
			strategyPercentages
		)
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(create2Address)

		const total = ethers.BigNumber.from('10000000000000000')
		const calls = await prepareDepositMulticall(
			strategy,
			controller,
			genericRouter,
			adapter,
			uniswapFactory,
			WETH,
			total,
			strategyTokens,
			strategyPercentages
		)
		const data = await genericRouter.encodeCalls(calls)

		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				name,
				symbol,
				strategyTokens,
				strategyPercentages,
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
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategy.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyTokens, WETH)
		//expect(await strategy.getStrategyValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
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
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should fail to deposit: total slipped', async function () {
		const call = await encodeTransferFrom(WETH, controller.address, accounts[1].address, 1)
		const data = await genericRouter.encodeCalls([call])
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, genericRouter.address, data, { value: 1 })
		).to.be.revertedWith('Lost value')
	})

	it('Should fail to deposit: leftover funds', async function () {
		const call = await encodeTransferFrom(WETH, controller.address, genericRouter.address, 1)
		const data = await genericRouter.encodeCalls([call])
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, genericRouter.address, data, { value: 1 })
		).to.be.revertedWith('Leftover funds')
	})

	it('Should fail to rebalance: no reentrancy', async function () {
		//Swap funds from token 1 to weth and send to router
		const balance = await tokens[1].balanceOf(strategy.address)
		const amount = (await oracle.consult(balance, tokens[1].address)).div(2) //Div by 2 to avoid any price slippage
		const uniswapCalls = await prepareUniswapSwap(
			genericRouter,
			adapter,
			uniswapFactory,
			strategy.address,
			genericRouter.address,
			balance,
			tokens[1],
			WETH
		)
		//Withdraw weth in eth
		const withdrawEncoded = await WETH.interface.encodeFunctionData('withdraw', [amount])
		const wethCalls = [{ target: WETH.address, callData: withdrawEncoded, value: 0 }]
		//Deposit eth to receive strategy tokens (should fail here because function will be locked)
		const depositCalls = await prepareDepositMulticall(
			strategy,
			controller,
			genericRouter,
			adapter,
			uniswapFactory,
			WETH,
			amount,
			strategyTokens,
			strategyPercentages
		)
		const depositData = await genericRouter.encodeCalls(depositCalls)
		const depositEncoded = await controller.interface.encodeFunctionData('deposit', [
			strategy.address,
			genericRouter.address,
			depositData,
		])
		const reentrancyCalls = [{ target: controller.address, callData: depositEncoded, value: amount }]

		const calls = [...uniswapCalls, ...wethCalls, ...reentrancyCalls]
		const data = await genericRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, genericRouter.address, data)
		).to.be.revertedWith('')
	})

	it('Should fail to rebalance: not balanced', async function () {
		const amount = ethers.BigNumber.from('100000000000') //Some arbitrary amount
		const call = await encodeDelegateSwap(
			genericRouter,
			strategy.address,
			adapter.address,
			amount,
			0,
			tokens[1].address,
			WETH.address
		)
		const data = await genericRouter.encodeCalls([call])
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, genericRouter.address, data)
		).to.be.revertedWith('not balanced')
	})

	it('Should fail to delegateSwap: swap failed', async function () {
		const amount = (await tokens[1].balanceOf(strategy.address)).add(1) // Too much
		const call = await encodeDelegateSwap(
			genericRouter,
			strategy.address,
			adapter.address,
			amount,
			0,
			tokens[1].address,
			WETH.address
		)
		const data = await genericRouter.encodeCalls([call])
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, genericRouter.address, data)
		).to.be.revertedWith('') //Revert in calldata
	})

	it('Should fail to rebalance: total slipped', async function () {
		const amount = ethers.BigNumber.from('100000000000000') //Some arbitrary amount
		// Setup rebalance
		const calls = []
		const buyLoop = []
		const tokens = await strategy.items()
		const [actualTotal, estimates] = await oracle.estimateTotal(strategy.address, tokens)
		const total = actualTotal.sub(amount)

		let wethInStrategy = false
		// Sell loop
		for (let i = 0; i < tokens.length; i++) {
			const token = await getContractAt(ERC20.abi, tokens[i])
			const estimatedValue = ethers.BigNumber.from(estimates[i])
			const expectedValue = ethers.BigNumber.from(await getExpectedTokenValue(total, token.address, strategy))
			const rebalanceRange = ethers.BigNumber.from(await getRebalanceRange(expectedValue, controller, strategy))
			if (estimatedValue.gt(expectedValue.add(rebalanceRange))) {
				if (token.address.toLowerCase() != WETH.address.toLowerCase()) {
					const diff = ethers.BigNumber.from(
						await adapter.spotPrice(estimatedValue.sub(expectedValue), WETH.address, token.address)
					)
					const swapCalls = await prepareUniswapSwap(
						genericRouter,
						adapter,
						uniswapFactory,
						strategy.address,
						genericRouter.address,
						diff,
						token,
						WETH
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
		// Take funds from strategy
		calls.push(await encodeTransferFrom(WETH, genericRouter.address, controller.address, amount))
		// Buy loop
		for (let i = 0; i < buyLoop.length; i++) {
			const token = await getContractAt(ERC20.abi, buyLoop[i].token)
			const estimatedValue = ethers.BigNumber.from(buyLoop[i].estimate)
			if (token.address.toLowerCase() != WETH.address.toLowerCase()) {
				if (!wethInStrategy && i == buyLoop.length - 1) {
					// The last token must use up the remainder of funds, but since balance is unknown, we call this function which does the final cleanup
					calls.push(
						await encodeSettleSwap(
							genericRouter,
							adapter.address,
							WETH.address,
							token.address,
							genericRouter.address,
							strategy.address
						)
					)
				} else {
					const expectedValue = ethers.BigNumber.from(
						await getExpectedTokenValue(total, token.address, strategy)
					)
					const rebalanceRange = ethers.BigNumber.from(
						await getRebalanceRange(expectedValue, controller, strategy)
					)
					if (estimatedValue.lt(expectedValue.sub(rebalanceRange))) {
						const diff = expectedValue.sub(estimatedValue).mul(FEE).div(DIVISOR)
						const swapCalls = await prepareUniswapSwap(
							genericRouter,
							adapter,
							uniswapFactory,
							genericRouter.address,
							strategy.address,
							diff,
							WETH,
							token
						)
						calls.push(...swapCalls)
					}
				}
			}
		}
		if (wethInStrategy) {
			calls.push(await encodeSettleTransfer(controller, WETH.address, strategy.address))
		}

		const data = await genericRouter.encodeCalls(calls)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, genericRouter.address, data)
		).to.be.revertedWith('value slipped!')
	})

	it('Should rebalance strategy with multicall', async function () {
		console.log('Rebalancing strategy....')
		// Multicall gets initial tokens from uniswap
		const calls = await prepareRebalanceMulticall(
			strategy,
			controller,
			genericRouter,
			adapter,
			oracle,
			uniswapFactory,
			WETH
		)
		const data = await genericRouter.encodeCalls(calls)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, genericRouter.address, data)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to call delegateSwap: only internal', async function () {
		await expect(
			genericRouter.delegateSwap(strategy.address, adapter.address, 1, 0, tokens[1].address, WETH.address, '0x')
		).to.be.revertedWith('Only internal')
	})

	it('Should fail to call settleSwap: only internal', async function () {
		await expect(
			genericRouter.settleSwap(
				adapter.address,
				tokens[1].address,
				WETH.address,
				strategy.address,
				accounts[1].address,
				'0x'
			)
		).to.be.revertedWith('Only internal')
	})
})