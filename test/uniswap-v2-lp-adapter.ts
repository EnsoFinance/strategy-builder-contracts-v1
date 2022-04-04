import { expect } from 'chai'
import { solidity } from 'ethereum-waffle'
const chai = require('chai')
chai.use(solidity)
import { ethers } from 'hardhat'
import { Contract, BigNumber, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { prepareStrategy, StrategyItem, InitialState } from '../lib/encode'
import {
	deployPlatform,
	deployUniswapV2,
	deployTokens,
	deployUniswapV2Adapter,
	deployUniswapV2LPAdapter,
	deployLoopRouter,
	deployGenericRouter
} from '../lib/deploy'
import { ITEM_CATEGORY, ESTIMATOR_CATEGORY } from '../lib/constants'
import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'

const { constants, getSigners, getContractFactory } = ethers
const { AddressZero, WeiPerEther, MaxUint256 } = constants

const NUM_TOKENS = 3
const STRATEGY_STATE: InitialState = {
	timelock: BigNumber.from(60),
	rebalanceThreshold: BigNumber.from(10),
	rebalanceSlippage: BigNumber.from(997),
	restructureSlippage: BigNumber.from(995),
	performanceFee: BigNumber.from(50),
	social: true,
	set: false
}

describe('UniswapV2LPAdapter', function () {
	let tokens: Contract[],
			tokenPair: Contract,
			wethPair: Contract,
			weth: Contract,
			uniswapFactory: Contract,
			strategyFactory: Contract,
			controller: Contract,
			oracle: Contract,
			library: Contract,
			loopRouter: Contract,
			genericRouter: Contract,
			uniswapV2Adapter: Contract,
			uniswapV2LPAdapter: Contract,
			strategy: Contract,
			wrapper: Contract,
			strategyItems: StrategyItem[],
			accounts: SignerWithAddress[],
			owner: SignerWithAddress


	before('Setup Uniswap, Factory, GenericRouter', async function () {
		accounts = await getSigners()
		owner = accounts[15]
		tokens = await deployTokens(owner, NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(owner, tokens)
		await uniswapFactory.createPair(tokens[1].address, tokens[2].address)

		const wethPairAddress = await uniswapFactory.getPair(tokens[1].address, weth.address)
		wethPair = new Contract(wethPairAddress, JSON.stringify(UniswapV2Pair.abi), owner)

		const tokenPairAddress = await uniswapFactory.getPair(tokens[1].address, tokens[2].address)
		tokenPair = new Contract(tokenPairAddress, JSON.stringify(UniswapV2Pair.abi), owner)
		// Add liquidity
		await tokens[1].connect(owner).transfer(tokenPairAddress, WeiPerEther.mul(100))
		await tokens[2].connect(owner).transfer(tokenPairAddress, WeiPerEther.mul(100))
		await tokenPair.connect(owner).mint(owner.address)

		const platform = await deployPlatform(owner, uniswapFactory, new Contract(AddressZero, [], owner), weth)
		strategyFactory = platform.strategyFactory
		controller = platform.controller
		oracle = platform.oracles.ensoOracle
		library = platform.library

		await strategyFactory.connect(owner).addItemToRegistry(
			ITEM_CATEGORY.BASIC,
			ESTIMATOR_CATEGORY.UNISWAP_V2_LP,
			tokenPair.address
		)

		const whitelist = platform.administration.whitelist
		uniswapV2Adapter = await deployUniswapV2Adapter(owner, uniswapFactory, weth)
		await whitelist.connect(owner).approve(uniswapV2Adapter.address)
		uniswapV2LPAdapter = await deployUniswapV2LPAdapter(owner, uniswapFactory, weth)
		await whitelist.connect(owner).approve(uniswapV2LPAdapter.address)
		loopRouter = await deployLoopRouter(owner, controller, library)
		await whitelist.connect(owner).approve(loopRouter.address)
		genericRouter = await deployGenericRouter(owner, controller)
		await whitelist.connect(owner).approve(genericRouter.address)
	})

	it('Should fail to swap: tokens cannot match', async function () {
		await expect(
			uniswapV2LPAdapter.swap(
				1,
				0,
				weth.address,
				weth.address,
				owner.address,
				owner.address
			)
		).to.be.revertedWith('Tokens cannot match')
	})

	it('Should fail to swap: tokens cannot match', async function () {
		await expect(
			uniswapV2LPAdapter.swap(
				1,
				0,
				tokens[1].address,
				tokenPair.address,
				owner.address,
				owner.address
			)
		).to.be.revertedWith('Token not supported')
	})

	it('Should fail to swap: less than expected', async function () {
		const amount = WeiPerEther
		await weth.approve(uniswapV2LPAdapter.address, amount)
		await expect(
			uniswapV2LPAdapter.swap(
				amount,
				MaxUint256,
				weth.address,
				tokenPair.address,
				owner.address,
				owner.address
			)
		).to.be.revertedWith('Insufficient tokenOut amount')
	})

	it('Should swap weth for LP', async function () {
		const amount = WeiPerEther
		await weth.connect(accounts[1]).deposit({value: amount})
		await weth.connect(accounts[1]).approve(uniswapV2LPAdapter.address, amount)
		const wethBalanceBefore = await weth.balanceOf(accounts[1].address)
		const lpBalanceBefore = await wethPair.balanceOf(accounts[1].address)
		await uniswapV2LPAdapter.connect(accounts[1]).swap(
			amount,
			0,
			weth.address,
			wethPair.address,
			accounts[1].address,
			accounts[1].address
		)
		const wethBalanceAfter = await weth.balanceOf(accounts[1].address)
		const lpBalanceAfter = await wethPair.balanceOf(accounts[1].address)
		expect(wethBalanceBefore.gt(wethBalanceAfter)).to.equal(true)
		expect(lpBalanceBefore.lt(lpBalanceAfter)).to.equal(true)
		expect((await weth.balanceOf(uniswapV2LPAdapter.address)).eq(0)).to.equal(true)
		expect((await tokens[1].balanceOf(uniswapV2LPAdapter.address)).eq(0)).to.equal(true)
		expect((await tokens[2].balanceOf(uniswapV2LPAdapter.address)).eq(0)).to.equal(true)
	})

	it('Should swap LP for weth', async function () {
		const wethBalanceBefore = await weth.balanceOf(accounts[1].address)
		const amount = await wethPair.balanceOf(accounts[1].address)
		await wethPair.connect(accounts[1]).approve(uniswapV2LPAdapter.address, amount)
		await uniswapV2LPAdapter.connect(accounts[1]).swap(
			amount,
			0,
			wethPair.address,
			weth.address,
			accounts[1].address,
			accounts[1].address
		)
		const wethBalanceAfter = await weth.balanceOf(accounts[1].address)
		expect(wethBalanceAfter.gt(wethBalanceBefore)).to.equal(true)
		expect((await wethPair.balanceOf(accounts[1].address)).eq(0)).to.equal(true)
		expect((await weth.balanceOf(uniswapV2LPAdapter.address)).eq(0)).to.equal(true)
		expect((await tokens[1].balanceOf(uniswapV2LPAdapter.address)).eq(0)).to.equal(true)
		expect((await tokens[2].balanceOf(uniswapV2LPAdapter.address)).eq(0)).to.equal(true)
	})

	it('Should deploy strategy', async function () {
		const positions = [
			{ token: tokenPair.address, percentage: BigNumber.from(500), adapters: [uniswapV2LPAdapter.address], path: [] },
			{ token: weth.address, percentage: BigNumber.from(500), adapters: [], path: [] }
		]
		strategyItems = prepareStrategy(positions, uniswapV2LPAdapter.address)

		let tx = await strategyFactory.connect(accounts[1]).createStrategy(
			accounts[1].address,
			'Test Strategy',
			'TEST',
			strategyItems,
			STRATEGY_STATE,
			loopRouter.address,
			'0x',
			{ value: ethers.BigNumber.from('10000000000000000') }
		)
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

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

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to do a flash swap attack', async function () {
			const attacker = accounts[13];
			const FlashSwapAttack = await getContractFactory('FlashSwapAttack')
			const flashSwapAttack = await FlashSwapAttack.connect(attacker).deploy(controller.address, genericRouter.address, loopRouter.address, weth.address)
			// Fund the attack contract to pay Uniswap fees
			await tokens[1].connect(owner).transfer(flashSwapAttack.address, WeiPerEther.mul(10))
			await tokens[2].connect(owner).transfer(flashSwapAttack.address, WeiPerEther.mul(10))
			// Initiate attack
			await expect(
				flashSwapAttack.connect(attacker).initiateAttack(tokenPair.address, strategy.address)
			).to.be.revertedWith('Lost value')
	})

	it('Should purchase tokens, increasing pool value, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(10)
		await weth.connect(accounts[19]).deposit({value: value.mul(2)})

		await weth.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, tokens[1].address, accounts[19].address, accounts[19].address)

		await weth.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, tokens[2].address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, loopRouter.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect((await weth.balanceOf(loopRouter.address)).eq(0)).to.equal(true)
		expect((await tokens[1].balanceOf(loopRouter.address)).eq(0)).to.equal(true)
		expect((await tokens[2].balanceOf(loopRouter.address)).eq(0)).to.equal(true)
	})

	it('Should sell tokens, reducing pool value, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		let value = await tokens[1].balanceOf(accounts[19].address)
		await tokens[1].connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, tokens[1].address, weth.address, accounts[19].address, accounts[19].address)

		value = await tokens[2].balanceOf(accounts[19].address)
		await tokens[2].connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, tokens[2].address, weth.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, loopRouter.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect((await weth.balanceOf(loopRouter.address)).eq(0)).to.equal(true)
		expect((await tokens[1].balanceOf(loopRouter.address)).eq(0)).to.equal(true)
		expect((await tokens[2].balanceOf(loopRouter.address)).eq(0)).to.equal(true)
	})

	it('Should fail to rebalance: price deviation', async function () {
		// Approve the user to use the adapter
		let value = WeiPerEther.mul(10)
		await weth.connect(accounts[19]).deposit({value: value})
		await weth.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, tokens[1].address, accounts[19].address, accounts[19].address)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, loopRouter.address, '0x')
		).to.be.revertedWith("Price deviation")
		// Reset price
		value = await tokens[1].balanceOf(accounts[19].address)
		await tokens[1].connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, tokens[1].address, weth.address, accounts[19].address, accounts[19].address)
	})

	it('Should fail to rebalance: price deviation', async function () {
		// Approve the user to use the adapter
		let value = WeiPerEther.mul(10)
		await weth.connect(accounts[19]).deposit({value: value})
		await weth.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, tokens[2].address, accounts[19].address, accounts[19].address)
		await expect(
			controller.connect(accounts[1]).rebalance(strategy.address, loopRouter.address, '0x')
		).to.be.revertedWith("Price deviation")
		// Reset price
		value = await tokens[2].balanceOf(accounts[19].address)
		await tokens[2].connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, tokens[2].address, weth.address, accounts[19].address, accounts[19].address)
	})
})
