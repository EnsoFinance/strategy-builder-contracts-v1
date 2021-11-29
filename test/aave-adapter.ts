import chai from 'chai'
const { expect } = chai
import { ethers } from 'hardhat'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { prepareStrategy, StrategyItem, StrategyState } from '../lib/encode'
import { Tokens } from '../lib/tokens'
import {
	deployAaveLendAdapter,
	deployAaveBorrowAdapter,
	deployUniswapV2Adapter,
	deployPlatform,
	deployFullRouter
} from '../lib/deploy'
import { MAINNET_ADDRESSES } from '../lib/utils'
import { displayBalances } from '../lib/logging'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'

chai.use(solidity)

describe('AaveAdapter', function () {
	let	weth: Contract,
		usdc: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		uniswapAdapter: Contract,
		aaveLendAdapter: Contract,
		aaveBorrowAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		tokens: Tokens,
		collateralToken: string,
		collateralToken2: string

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		usdc = new Contract(tokens.usdc, ERC20.abi, accounts[0])
		uniswapFactory = new Contract(MAINNET_ADDRESSES.UNISWAP, UniswapV2Factory.abi, accounts[0])
		const platform = await deployPlatform(accounts[0], uniswapFactory, weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		const whitelist = platform.administration.whitelist
		const addressProvider = new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], accounts[0])

		await tokens.registerTokens(accounts[0], strategyFactory)

		router = await deployFullRouter(accounts[0], addressProvider, controller)
		await whitelist.connect(accounts[0]).approve(router.address)
		uniswapAdapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapAdapter.address)
		aaveLendAdapter = await deployAaveLendAdapter(accounts[0], addressProvider, controller, weth)
		await whitelist.connect(accounts[0]).approve(aaveLendAdapter.address)
		aaveBorrowAdapter = await deployAaveBorrowAdapter(accounts[0], addressProvider, weth)
		await whitelist.connect(accounts[0]).approve(aaveBorrowAdapter.address)
	})

	it('Should deploy strategy', async function () {
		collateralToken = tokens.aWETH
		collateralToken2 = tokens.aWBTC
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: collateralToken,
				percentage: BigNumber.from(1000),
				adapters: [aaveLendAdapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(
	        ['uint16'],
	        [500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
	      ),
			},
			{ token: collateralToken2,
				percentage: BigNumber.from(1000),
				adapters: [uniswapAdapter.address, aaveLendAdapter.address],
				path: [tokens.wbtc],
				cache: ethers.utils.defaultAbiCoder.encode(
	        ['uint16'],
	        [500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
	      ),
			},
			{ token: tokens.debtUSDC,
				percentage: BigNumber.from(-1000),
				adapters: [aaveBorrowAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, tokens.weth], //ending in weth allows for a leverage feedback loop
				cache: ethers.utils.defaultAbiCoder.encode(
	        ['address[]'],
	        [[collateralToken, collateralToken2]] //define what tokens you want to loop back on here
	      ),
			}
		]
		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: StrategyState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			slippage: BigNumber.from(980), // Restucturing from this strategy requires higher slippage tolerance
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
				{ value: WeiPerEther }
			)
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		console.log("Strategy address: ", strategyAddress)
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(1000)
		await weth.connect(accounts[19]).deposit({value: value})
		await weth.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, usdc.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = await usdc.balanceOf(accounts[19].address)
		await usdc.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, usdc.address, weth.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should fail to withdrawAll: cannot withdraw debt', async function() {
		const amount = BigNumber.from('10000000000000000')
		await expect(strategy.connect(accounts[1]).withdrawAll(amount)).to.be.revertedWith('Cannot withdraw debt')
	})

	it('Should withdraw ETH', async function () {
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const amount = BigNumber.from('5000000000000000')
		const ethBalanceBefore = await accounts[1].getBalance()
		const tx = await controller.connect(accounts[1]).withdrawETH(strategy.address, router.address, amount, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const ethBalanceAfter = await accounts[1].getBalance()
		expect(ethBalanceAfter.gt(ethBalanceBefore)).to.equal(true)
	})

	it('Should withdraw WETH', async function () {
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const amount = BigNumber.from('5000000000000000')
		const wethBalanceBefore = await weth.balanceOf(accounts[1].address)
		const tx = await controller.connect(accounts[1]).withdrawWETH(strategy.address, router.address, amount, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const wethBalanceAfter = await weth.balanceOf(accounts[1].address)
		expect(wethBalanceAfter.gt(wethBalanceBefore)).to.equal(true)
	})

	it('Should restructure', async function () {
		const positions = [
			{ token: collateralToken,
				percentage: BigNumber.from(2000),
				adapters: [aaveLendAdapter.address],
				path: [],
				cache: ethers.utils.defaultAbiCoder.encode(
	        ['uint16'],
	        [500] // Multiplier 50% (divisor = 1000). For calculating the amount to purchase based off of the percentage
	      ),
			},
			{ token: tokens.debtUSDC,
				percentage: BigNumber.from(-1000),
				adapters: [aaveBorrowAdapter.address, uniswapAdapter.address],
				path: [tokens.usdc, tokens.weth],
				cache: ethers.utils.defaultAbiCoder.encode(
	        ['address[]'],
	        [[collateralToken, collateralToken2]] //Need to keep collateralToken2 in the cache in order to deleverage it
	      ),
			}
		]
		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		await controller.connect(accounts[1]).restructure(strategy.address, strategyItems)
	})

	it('Should finalize structure', async function () {
		await controller
			.connect(accounts[1])
			.finalizeStructure(strategy.address, router.address, '0x')
	})

	it('Should check spot price (deposit)', async function () {
		const price = await aaveLendAdapter.spotPrice(WeiPerEther, tokens.usdc, tokens.aDAI)
		expect(price.gt(0)).to.equal(true)
	})

	it('Should check spot price (withdraw)', async function () {
		const price = await aaveLendAdapter.spotPrice(WeiPerEther, tokens.aDAI, tokens.usdc)
		expect(price.gt(0)).to.equal(true)
	})

	it('Should check spot price: same', async function () {
		const price = await aaveLendAdapter.spotPrice(WeiPerEther, tokens.aDAI, tokens.aDAI)
		expect(price.eq(WeiPerEther)).to.equal(true)
	})

	it('Should check spot price (borrow)', async function () {
		const price = await aaveBorrowAdapter.spotPrice(WeiPerEther, AddressZero, tokens.usdc)
		expect(price.gt(0)).to.equal(true)
	})

	it('Should check spot price (repay)', async function () {
		const price = await aaveBorrowAdapter.spotPrice(WeiPerEther, tokens.usdc, AddressZero)
		expect(price.gt(0)).to.equal(true)
	})

	it('Should check borrow spot price (no lending pool)', async function () {
		const price = await aaveBorrowAdapter.spotPrice(WeiPerEther, tokens.dai, tokens.weth)
		expect(price.eq(0)).to.equal(true)
	})
})
