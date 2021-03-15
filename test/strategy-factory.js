const { expect } = require('chai')
const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners } = ethers
const { WeiPerEther } = constants
const { deployTokens, deployUniswap, deployPlatform, deployLoopRouter } = require('./helpers/deploy.js')
const { prepareStrategy } = require('./helpers/encode.js')

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH

describe('StrategyProxyFactory', function () {
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
		strategy2,
		strategyTokens,
		strategyPercentages,
		strategyAdapters,
		newFactory,
		newOracle,
		newWhitelist,
		newRouter,
		newImplementationAddress

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		uniswapFactory = await deployUniswap(accounts[0], tokens)
		;[strategyFactory, controller, oracle, whitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH)
		;[router, adapter] = await deployLoopRouter(accounts[0], controller, uniswapFactory, WETH)
		await whitelist.connect(accounts[0]).approve(router.address)
	})

	before('Setup new implementation, oracle, whitelist', async function () {
		;[newFactory, , newOracle, newWhitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH)
		;[newRouter] = await deployLoopRouter(accounts[0], controller, uniswapFactory, WETH)
		await newWhitelist.connect(accounts[0]).approve(newRouter.address)
		newImplementationAddress = await newFactory.implementation()
	})

	before('Should deploy strategy', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: 500 },
			{ token: tokens[2].address, percentage: 500 },
		]
		;[strategyTokens, strategyPercentages, strategyAdapters] = prepareStrategy(positions, adapter.address)
		// let duplicateTokens = strategyTokens
		// duplicateTokens[0] = strategyTokens[1]
		// TODO: strategy is currently accepting duplicate tokens
		const amount = ethers.BigNumber.from('10000000000000000')
		const Strategy = await getContractFactory('Strategy')
		//First strategy
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				'Test Strategy',
				'TEST',
				strategyTokens,
				strategyPercentages,
				false,
				0,
				REBALANCE_THRESHOLD,
				SLIPPAGE,
				TIMELOCK,
				router.address,
				data,
				{ value: amount }
			)
		let receipt = await tx.wait()
		const strategyAddress = receipt.events.find((ev) => ev.event === 'NewStrategy').args.strategy
		strategy = Strategy.attach(strategyAddress)

		//Second portolio
		tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				'Test Strategy 2',
				'TEST2',
				strategyTokens,
				strategyPercentages,
				false,
				0,
				REBALANCE_THRESHOLD,
				SLIPPAGE,
				TIMELOCK,
				router.address,
				'0x'
			)
		receipt = await tx.wait()
		const strategyAddress2 = receipt.events.find((ev) => ev.event === 'NewStrategy').args.strategy
		strategy2 = Strategy.attach(strategyAddress2)
	})

	it('Should fail to update oracle: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).updateOracle(newOracle.address)).to.be.revertedWith(
			'caller is not the owner'
		)
	})

	it('Should update oracle', async function () {
		expect(await strategy.oracle()).to.equal(oracle.address)
		await strategyFactory.connect(accounts[0]).updateOracle(newOracle.address)
		expect(await strategyFactory.oracle()).to.equal(newOracle.address)
		expect(await strategy.oracle()).to.equal(newOracle.address)
	})

	it('Should fail to update whitelist: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).updateWhitelist(newWhitelist.address)).to.be.revertedWith(
			'caller is not the owner'
		)
	})

	it('Should update whitelist', async function () {
		const oldBalance = await strategy.balanceOf(accounts[1].address)
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, newRouter.address, data, {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		).to.be.revertedWith('Router not approved')
		await strategyFactory.connect(accounts[0]).updateWhitelist(newWhitelist.address)
		expect(await strategyFactory.whitelist()).to.equal(newWhitelist.address)
		await controller
			.connect(accounts[1])
			.deposit(strategy.address, newRouter.address, data, { value: ethers.BigNumber.from('10000000000000000') })
		const newBalance = await strategy.balanceOf(accounts[1].address)
		expect(ethers.BigNumber.from(newBalance).gt(oldBalance)).to.equal(true)
	})

	it('Should fail to update implementation: not owner', async function () {
		await expect(
			strategyFactory.connect(accounts[1]).updateImplementation(newImplementationAddress)
		).to.be.revertedWith('caller is not the owner')
	})

	it('Should update implementation', async function () {
		await strategyFactory.connect(accounts[0]).updateImplementation(newImplementationAddress)
		expect(await strategyFactory.implementation()).to.equal(newImplementationAddress)
		expect(ethers.BigNumber.from(await strategyFactory.version()).eq(2)).to.equal(true)
		expect(await strategyFactory.getProxyImplementation(strategy.address)).to.not.equal(newImplementationAddress)
	})

	it('Should fail to upgrade strategy proxy: not admin', async function () {
		await expect(strategyFactory.connect(accounts[0]).upgrade(strategy.address)).to.be.revertedWith(
			'PPF.onlyManager: Not manager'
		)
	})

	it('Should upgrade strategy proxy', async function () {
		await strategyFactory.connect(accounts[1]).upgrade(strategy.address)
		expect(await strategyFactory.getProxyImplementation(strategy.address)).to.equal(newImplementationAddress)
	})

	it('Should upgrade and call strategy proxy', async function () {
		const data = strategy2.interface.encodeFunctionData('manager', [])
		await strategyFactory.connect(accounts[1]).upgradeAndCall(strategy2.address, data)
		expect(await strategyFactory.getProxyImplementation(strategy2.address)).to.equal(newImplementationAddress)
	})

	it('Should fail to change proxy admin: not admin', async function () {
		await expect(
			strategyFactory.connect(accounts[2]).changeProxyAdmin(strategy.address, newFactory.address)
		).to.be.revertedWith('PPF.onlyManager: Not manager')
	})

	it('Should change proxy admin', async function () {
		await strategyFactory.connect(accounts[1]).changeProxyAdmin(strategy.address, newFactory.address)
		expect(await newFactory.getProxyAdmin(strategy.address)).to.equal(newFactory.address)
	})

	it('Should fail to get implementation: not proxy admin', async function () {
		await expect(strategyFactory.getProxyImplementation(strategy.address)).to.be.revertedWith()
	})

	it('Should fail to get proxy admin: not proxy admin', async function () {
		await expect(strategyFactory.getProxyAdmin(strategy.address)).to.be.revertedWith()
	})
})
