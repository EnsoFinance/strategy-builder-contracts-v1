import chai from 'chai'
const { expect } = chai
import { ethers } from 'hardhat'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { prepareStrategy, StrategyItem, InitialState } from '../lib/encode'
import { increaseTime } from '../lib/utils'
import { Tokens } from '../lib/tokens'

import {
	deployTokens,
	deployEnsoToken,
	deployEnsoStakingAdapter,
	deployEnsoEstimator,
	deployStakedEnsoEstimator,
	deployPlatform,
	deployLoopRouter,
	deployUniswapV2Adapter,
	deployUniswapV2,
} from '../lib/deploy'

import {
		ITEM_CATEGORY,
		ESTIMATOR_CATEGORY,
} from '../lib/constants'

chai.use(solidity)

let NUM_TOKENS = 3

describe('EnsoStakingAdapter', function () {

	let	weth: Contract,
		usdc: Contract,
		accounts: SignerWithAddress[],
		ensoToken: Contract,
		sEnso: Contract,
		stakingMock: Contract,
		ensoStakingAdapter: Contract,
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		library: Contract,
		uniswapAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		tokens: Tokens

	before('Setup StakingAdapter + Factory', async function () {
		accounts = await getSigners()
		tokens = new Tokens()
		let tokens_ = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))

		weth = tokens_[0]
		usdc = tokens_[1]

		ensoToken = await deployEnsoToken(accounts[0], accounts[0], "EnsoToken", "ENS", Date.now())

		uniswapFactory = await deployUniswapV2(accounts[0], [weth, ensoToken, usdc])

		const platform = await deployPlatform(accounts[0], uniswapFactory, new Contract(AddressZero, [], accounts[0]), weth)

		const whitelist = platform.administration.whitelist

		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		library = platform.library
		let tokenRegistry = platform.oracles.registries.tokenRegistry

		let defaultEstimator = new Contract(await tokenRegistry.getEstimator(weth.address), [], accounts[0]) // just to use its address in the "deploy" functions

		const StakingMockFactory = await getContractFactory('StakingMock')
		stakingMock = await StakingMockFactory.deploy(ensoToken.address)
		await stakingMock.deployed()
		sEnso = stakingMock

		let ensoEstimator = await deployEnsoEstimator(accounts[0], sEnso, defaultEstimator, strategyFactory)
		let stakedEnsoEstimator = await deployStakedEnsoEstimator(accounts[0], strategyFactory)


		await strategyFactory.connect(accounts[0]).addEstimatorToRegistry(ESTIMATOR_CATEGORY.ENSO, ensoEstimator.address)
		await strategyFactory.connect(accounts[0]).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.ENSO, ensoToken.address)

		ensoStakingAdapter = await deployEnsoStakingAdapter(accounts[0], stakingMock, ensoToken, sEnso, weth)
		await whitelist.connect(accounts[0]).approve(ensoStakingAdapter.address)

		await strategyFactory.connect(accounts[0]).addEstimatorToRegistry(ESTIMATOR_CATEGORY.ENSO_STAKED, stakedEnsoEstimator.address)
		await strategyFactory.connect(accounts[0]).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.ENSO_STAKED, sEnso.address)

		await tokens.registerTokens(accounts[0], strategyFactory)
		router = await deployLoopRouter(accounts[0], controller, library)
		await whitelist.connect(accounts[0]).approve(router.address)

		uniswapAdapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapAdapter.address)
		await ensoToken.approve(uniswapAdapter.address, constants.MaxUint256)

	})

	it('Should deploy strategy', async function () {
		const _3hrs = 3*60*60
		await increaseTime(_3hrs)

		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: ensoToken.address, percentage: BigNumber.from(0), adapters: [uniswapAdapter.address] },
			{ token: usdc.address, percentage: BigNumber.from(500), adapters: [uniswapAdapter.address] },
			{ token: sEnso.address, percentage: BigNumber.from(500), adapters: [uniswapAdapter.address, ensoStakingAdapter.address], path: [ensoToken.address] }
		]
		let value = ethers.BigNumber.from('10000000000000000')
		strategyItems = prepareStrategy(positions, ensoStakingAdapter.address)

		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(995),
			performanceFee: BigNumber.from(0),
			social: false,
			set: false
		}

		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				strategyItems,
				strategyState,
				router.address,
				'0x',
				{ value: value }
			)
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		// await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {

		expect(await wrapper.isBalanced()).to.equal(true)

		// Approve the user to use the adapter
		const value = WeiPerEther.mul(1000)
		await weth.connect(accounts[19]).deposit({value: value})
		await weth.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, ensoToken.address, accounts[19].address, accounts[19].address)

		// await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)

	})

	it('Should rebalance strategy', async function () {

		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		// await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)

	})

	it('Should claim rewards', async function() {

		await strategy.connect(accounts[1]).claimRewards(ensoStakingAdapter.address, sEnso.address)

	})
})
