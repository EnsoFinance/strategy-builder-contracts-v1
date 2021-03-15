const BigNumber = require('bignumber.js')
const { expect } = require('chai')
const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
const { deployTokens, deployUniswap, deployPlatform, deployLoopRouter } = require('./helpers/deploy.js')
//const { displayBalances } = require('./helpers/logging.js')
const { prepareStrategy } = require('./helpers/encode.js')
const { TIMELOCK_CATEGORY } = require('./helpers/utils.js')

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH

describe('StrategyController', function () {
	let tokens,
		accounts,
		uniswapFactory,
		strategyFactory,
		controller,
		oracle,
		whitelist,
		router,
		adapter,
		strategy,
		strategyTokens,
		strategyPercentages,
		strategyAdapters,
		wrapper,
		newThreshold

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		uniswapFactory = await deployUniswap(accounts[0], tokens)
		;[strategyFactory, controller, oracle, whitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH)
		;[router, adapter] = await deployLoopRouter(accounts[0], controller, uniswapFactory, WETH)
		await whitelist.connect(accounts[0]).approve(router.address)
	})

	it('Should fail to deploy strategy: threshold too high', async function () {
		await expect(
			strategyFactory
				.connect(accounts[1])
				.createStrategy(
					'Fail Strategy',
					'FAIL',
					[],
					[],
					false,
					0,
					10001,
					SLIPPAGE,
					TIMELOCK,
					router.address,
					'0x'
				)
		).to.be.revertedWith('slippage/threshold high')
	})

	it('Should fail to deploy strategy: slippage too high', async function () {
		await expect(
			strategyFactory
				.connect(accounts[1])
				.createStrategy(
					'Fail Strategy',
					'FAIL',
					[],
					[],
					false,
					0,
					REBALANCE_THRESHOLD,
					1001,
					TIMELOCK,
					router.address,
					'0x'
				)
		).to.be.revertedWith('slippage/threshold high')
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
		;[strategyTokens, strategyPercentages, strategyAdapters] = prepareStrategy(positions, adapter.address)
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		const tx = await strategyFactory
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
				router.address,
				data,
				{ value: ethers.BigNumber.from('10000000000000000') }
			)
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to setup strategy: initialized', async function () {
		await expect(
			controller.setupStrategy(accounts[1].address, strategy.address, false, 0, 0, 0, 0, router.address, '0x')
		).to.be.revertedWith('already setup')
	})

	it('Should fail to update value: restructure is invalid option', async function () {
		await expect(
			controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.RESTRUCTURE, 0)
		).to.be.revertedWith('')
	})

	it('Should fail to update value: option out of bounds', async function () {
		await expect(controller.connect(accounts[1]).updateValue(strategy.address, 5, 0)).to.be.revertedWith('')
	})

	it('Should fail to update threshold: not manager', async function () {
		await expect(
			controller.connect(accounts[0]).updateValue(strategy.address, TIMELOCK_CATEGORY.THRESHOLD, 1)
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to update threshold: value too large', async function () {
		await expect(
			controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.THRESHOLD, 1001)
		).to.be.revertedWith('PC.uV: Value too high')
	})

	it('Should update threshold', async function () {
		newThreshold = 15
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.THRESHOLD, newThreshold)
	})

	it('Should fail to finalize restrucuture: timelock not set for restructure', async function () {
		await expect(
			controller.connect(accounts[1]).finalizeStructure(strategy.address, router.address, [], [])
		).to.be.revertedWith('Wrong category')
	})

	it('Should finalize value', async function () {
		expect(
			ethers.BigNumber.from(await controller.rebalanceThreshold(strategy.address)).eq(REBALANCE_THRESHOLD)
		).to.equal(true)
		await controller.finalizeValue(strategy.address)
		expect(ethers.BigNumber.from(await controller.rebalanceThreshold(strategy.address)).eq(newThreshold)).to.equal(
			true
		)
	})

	it('Should fail to update slippage: not manager', async function () {
		await expect(
			controller.connect(accounts[0]).updateValue(strategy.address, TIMELOCK_CATEGORY.SLIPPAGE, 1)
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to update slippage: value too large', async function () {
		await expect(
			controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.SLIPPAGE, 1001)
		).to.be.revertedWith('PC.uV: Value too high')
	})

	it('Should update slippage', async function () {
		const slippage = 996
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.SLIPPAGE, slippage)
		await controller.finalizeValue(strategy.address)
		expect(ethers.BigNumber.from(await controller.slippage(strategy.address)).eq(slippage)).to.equal(true)
	})

	it('Should fail to update timelock: not manager', async function () {
		await expect(
			controller.connect(accounts[0]).updateValue(strategy.address, TIMELOCK_CATEGORY.TIMELOCK, 1)
		).to.be.revertedWith('Not manager')
	})

	it('Should update timelock', async function () {
		const timelock = 1
		await controller.connect(accounts[1]).updateValue(strategy.address, TIMELOCK_CATEGORY.TIMELOCK, timelock)
		await controller.finalizeValue(strategy.address)
		expect(ethers.BigNumber.from(await controller.timelock(strategy.address)).eq(timelock)).to.equal(true)
	})

	it('Should fail to rebalance, already balanced', async function () {
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
		).to.be.revertedWith('PC.rebalance: balanced')
	})

	it('Should purchase a token, requiring a rebalance', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(50)
		await adapter
			.connect(accounts[2])
			.swap(value, 0, AddressZero, strategyTokens[0], accounts[2].address, accounts[2].address, [], [], {
				value: value,
			})
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should fail to rebalance, router not approved', async function () {
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		await expect(controller.connect(accounts[1]).rebalance(strategy.address, AddressZero, data)).to.be.revertedWith(
			'Router not approved'
		)
	})

	it('Should rebalance strategy', async function () {
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to rebalance, only manager may rebalance', async function () {
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		await expect(
			controller.connect(accounts[2]).rebalance(strategy.address, router.address, data)
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to deposit: not manager', async function () {
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		await expect(
			controller
				.connect(accounts[0])
				.deposit(strategy.address, router.address, data, { value: ethers.BigNumber.from('10000000000000000') })
		).to.be.revertedWith('Not manager')
	})

	it('Should fail to deposit: no funds deposited', async function () {
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, router.address, data)
		).to.be.revertedWith('PC.deposit: No ether sent')
	})

	it('Should fail to deposit: incorrect adapters', async function () {
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, []])
		await expect(
			controller
				.connect(accounts[1])
				.deposit(strategy.address, router.address, data, { value: ethers.BigNumber.from('10000000000000000') })
		).to.be.revertedWith('Routers/items mismatch')
	})

	it('Should deposit more', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[1].address)
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, router.address, data, { value: ethers.BigNumber.from('10000000000000000') })
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[1].address)
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
	})

	it('Should fail to withdraw: no strategy tokens', async function () {
		await expect(controller.connect(accounts[0]).withdrawAssets(strategy.address, 1)).to.be.revertedWith(
			'ERC20: Amount exceeds balance'
		)
	})

	it('Should fail to withdraw: no amount passed', async function () {
		await expect(controller.connect(accounts[1]).withdrawAssets(strategy.address, 0)).to.be.revertedWith(
			'PC.withdraw: No amount'
		)
	})

	it('Should withdraw', async function () {
		const amount = ethers.BigNumber.from('10000000000000')
		const supplyBefore = BigNumber((await strategy.totalSupply()).toString())
		const tokenBalanceBefore = BigNumber((await tokens[1].balanceOf(strategy.address)).toString())
		const tx = await controller.connect(accounts[1]).withdrawAssets(strategy.address, amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const supplyAfter = BigNumber((await strategy.totalSupply()).toString())
		const tokenBalanceAfter = BigNumber((await tokens[1].balanceOf(strategy.address)).toString())
		expect(supplyBefore.minus(amount.toString()).isEqualTo(supplyAfter)).to.equal(true)
		expect(
			supplyBefore
				.dividedBy(supplyAfter)
				.decimalPlaces(10)
				.isEqualTo(tokenBalanceBefore.dividedBy(tokenBalanceAfter).decimalPlaces(10))
		).to.equal(true)
		expect(tokenBalanceBefore.isGreaterThan(tokenBalanceAfter)).to.equal(true)
	})

	it('Should fail to restructure: wrong array length', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: 500 },
			{ token: tokens[1].address, percentage: 500 },
			{ token: tokens[2].address, percentage: 0 },
		]
		;[strategyTokens, strategyPercentages, strategyAdapters] = prepareStrategy(positions, adapter.address)
		await expect(
			controller.connect(accounts[1]).restructure(strategy.address, strategyTokens, [500, 500])
		).to.be.revertedWith('invalid input lengths')
	})

	it('Should fail to restructure: wrong percentages', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: 300 },
			{ token: tokens[1].address, percentage: 300 },
			{ token: tokens[2].address, percentage: 300 },
		]
		;[strategyTokens, strategyPercentages, strategyAdapters] = prepareStrategy(positions, adapter.address)
		await expect(
			controller.connect(accounts[1]).restructure(strategy.address, strategyTokens, strategyPercentages)
		).to.be.revertedWith('total percentage wrong')
	})

	it('Should fail to restructure: not manager', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: 300 },
			{ token: tokens[1].address, percentage: 300 },
			{ token: tokens[2].address, percentage: 400 },
		]
		;[strategyTokens, strategyPercentages, strategyAdapters] = prepareStrategy(positions, adapter.address)
		await expect(
			controller.connect(accounts[2]).restructure(strategy.address, strategyTokens, strategyPercentages)
		).to.be.revertedWith('Not manager')
	})

	it('Should restructure', async function () {
		const positions = [
			{ token: tokens[0].address, percentage: 300 },
			{ token: tokens[1].address, percentage: 300 },
			{ token: tokens[2].address, percentage: 400 },
		]
		;[strategyTokens, strategyPercentages, strategyAdapters] = prepareStrategy(positions, adapter.address)
		await controller.connect(accounts[1]).restructure(strategy.address, strategyTokens, strategyPercentages)
	})

	it('Should fail to finalize value: wrong category', async function () {
		await expect(controller.finalizeValue(strategy.address)).to.be.revertedWith('Wrong category')
	})

	it('Should fail to finalize structure: sell adapters mismatch', async function () {
		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, router.address, strategyAdapters, strategyAdapters)
		).to.be.revertedWith('PC._fS: Sell adapters length')
	})

	it('Should fail to finalize structure: buy adapters mismatch', async function () {
		const currentTokens = await strategy.items()
		const sellAdapters = currentTokens.map(() => adapter.address)

		await expect(
			controller
				.connect(accounts[1])
				.finalizeStructure(strategy.address, router.address, sellAdapters, sellAdapters)
		).to.be.revertedWith('PC._fS: Buy adapters length')
	})

	/* Not social
  it('Should fail to finalize structure: time lock not passed', async function() {
    await expect( controller.connect(accounts[1]).finalizeStructure(strategy.address, router.addressstrategyTokens, strategyPercentages, strategyAdapters, strategyAdapters))
      .to.be.revertedWith('Can only restructure after enough time has passed')
  })
  */

	it('Should finalize structure', async function () {
		const currentTokens = await strategy.items()
		const sellAdapters = currentTokens.map(() => adapter.address)

		await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, router.address, sellAdapters, strategyAdapters)
		//await displayBalances(wrapper, strategyTokens, WETH)
	})

	it('Should purchase a token, requiring a rebalance', async function () {
		const value = WeiPerEther.mul(100)
		await adapter
			.connect(accounts[2])
			.swap(value, 0, AddressZero, tokens[2].address, accounts[2].address, accounts[2].address, [], [], {
				value: value,
			})
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const estimates = await Promise.all(
			strategyTokens.map(async (token) => (await wrapper.getTokenValue(token)).toString())
		)
		const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
		const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, data)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, WETH)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to open strategy: not manager', async function () {
		await expect(controller.connect(accounts[0]).openStrategy(strategy.address, 0)).to.be.revertedWith(
			'Not manager'
		)
	})

	it('Should fail to open strategy: fee too high', async function () {
		await expect(controller.connect(accounts[1]).openStrategy(strategy.address, 1000)).to.be.revertedWith(
			'Fee too high'
		)
	})

	it('Should open strategy', async function () {
		await controller.connect(accounts[1]).openStrategy(strategy.address, 10)
		expect(await controller.social(strategy.address)).to.equal(true)
	})

	it('Should call update on oracle', async function () {
		const tx = await oracle.update(tokens[1].address)
		const receipt = await tx.wait()
		const newPriceEvent = receipt.events.find((ev) => ev.event === 'NewPrice').args
		expect(newPriceEvent.token.toLowerCase()).to.equal(tokens[1].address.toLowerCase())
		expect(newPriceEvent.price.gt(0)).to.equal(true)
	})

	it('Should return 0 when passing 0 to consult', async function () {
		const value = await oracle.consult(0, tokens[1].address)
		expect(value.eq(0)).to.equal(true)
	})

	it('Should return value when consult oracle about weth price', async function () {
		const value = await oracle.consult(1, tokens[0].address)
		expect(value.eq(1)).to.equal(true)
	})

	it('Should return 0 when estimating total of ETH in strategy', async function () {
		const [total, estimates] = await oracle.estimateTotal(strategy.address, [AddressZero])
		expect(total.eq(0)).to.equal(true)
		expect(estimates[0].eq(0)).to.equal(true)
	})
})
