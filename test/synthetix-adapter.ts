import chai from 'chai'
const { expect } = chai
import { ethers, network } from 'hardhat'
const { constants, getContractFactory, getSigners } = ethers
const { WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { prepareStrategy, StrategyItem, StrategyState } from '../lib/encode'
import { Tokens } from '../lib/tokens'
import {
	deploySynthetixAdapter,
	deployCurveAdapter,
	deployUniswapV2Adapter,
	deployPlatform,
	deployFullRouter
} from '../lib/deploy'
import { increaseTime, MAINNET_ADDRESSES } from '../lib/utils'
//import { displayBalances } from '../lib/logging'
import IAddressResolver from '../artifacts/contracts/interfaces/synthetix/IAddressResolver.sol/IAddressResolver.json'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'

chai.use(solidity)

describe('SynthetixAdapter', function () {
	let	weth: Contract,
		crv: Contract,
		susd: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		uniswapAdapter: Contract,
		curveAdapter: Contract,
		synthetixAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		tokens: Tokens

	before('Setup Synthetix, Uniswap, Curve, Enso', async function () {
		// @ts-ignore
		const forking = network.config.forking
		await network.provider.request({
		  method: "hardhat_reset",
		  params: [
		    {
		      forking: {
		        jsonRpcUrl: forking.url,
		        blockNumber: forking.blockNumber,
		      },
		    },
		  ],
		})


		accounts = await getSigners()
		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		crv = new Contract(tokens.crv, ERC20.abi, accounts[0])
		susd = new Contract(tokens.sUSD, ERC20.abi, accounts[0]);
		uniswapFactory = new Contract(MAINNET_ADDRESSES.UNISWAP, UniswapV2Factory.abi, accounts[0])
		const platform = await deployPlatform(accounts[10], uniswapFactory, weth, susd)
		strategyFactory = platform.strategyFactory
		controller = platform.controller
		oracle = platform.oracles.ensoOracle
		const chainlinkOracle = platform.oracles.protocols.chainlinkOracle
		const whitelist = platform.administration.whitelist

		await tokens.registerTokens(accounts[10], strategyFactory)

		const resolver = new Contract('0x823bE81bbF96BEc0e25CA13170F5AaCb5B79ba83', IAddressResolver.abi, accounts[0]);

		const CurvePoolRegistry = await getContractFactory('CurvePoolRegistry')
		const curvePoolRegistry = await CurvePoolRegistry.connect(accounts[10]).deploy()
		await curvePoolRegistry.deployed()

		//crvsusd
		await curvePoolRegistry.connect(accounts[10]).addPool(
			'0xC25a3A3b969415c80451098fa907EC722572917F', // token
			'0xfcba3e75865d2d561be8d220616520c171f12851', // swap
			'0xA5407eAE9Ba41422680e2e00537571bcC53efBfD',	// deposit
			'0xA90996896660DEcC6E997655E065b23788857849', // gauge
			true // isInt128
		);

		await chainlinkOracle.connect(accounts[10]).addOracle(tokens.sUSD, MAINNET_ADDRESSES.WETH, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', true);
		await chainlinkOracle.connect(accounts[10]).addOracle(tokens.sEUR, tokens.sUSD, '0xb49f677943BC038e9857d61E7d053CaA2C1734C1', false);

		router = await deployFullRouter(accounts[10], controller)
		await whitelist.connect(accounts[10]).approve(router.address)
		uniswapAdapter = await deployUniswapV2Adapter(accounts[10], uniswapFactory, weth)
		await whitelist.connect(accounts[10]).approve(uniswapAdapter.address)
		curveAdapter = await deployCurveAdapter(accounts[10], curvePoolRegistry, weth)
		await whitelist.connect(accounts[10]).approve(curveAdapter.address)
		synthetixAdapter = await deploySynthetixAdapter(accounts[10], resolver, weth)
		await whitelist.connect(accounts[10]).approve(synthetixAdapter.address)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(0) },
			{ token: crv.address, percentage: BigNumber.from(400) },
			{ token: tokens.sUSD, percentage: BigNumber.from(400), adapters: [uniswapAdapter.address, curveAdapter.address], path: [tokens.usdc] },
			{ token: tokens.sEUR, percentage: BigNumber.from(200), adapters: [synthetixAdapter.address], path: [] }
		]
		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: StrategyState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			slippage: BigNumber.from(990),
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
				{ value: ethers.BigNumber.from('10000000000000000') }
			)
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper')
		wrapper = await LibraryWrapper.connect(accounts[0]).deploy(oracle.address, strategyAddress)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(100)
		await weth.connect(accounts[19]).deposit({value: value})
		await weth.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, crv.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should withdraw synths into reserve', async function () {
		await increaseTime(600);
		await controller.connect(accounts[1]).settleSynths(strategy.address, synthetixAdapter.address, susd.address);
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(360);
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = await crv.balanceOf(accounts[19].address)
		await crv.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, crv.address, weth.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should withdraw synths into reserve', async function () {
		await increaseTime(600);
		await controller.connect(accounts[1]).settleSynths(strategy.address, synthetixAdapter.address, susd.address);
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(360);
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should check spot price (deposit)', async function () {
		const price = await synthetixAdapter.spotPrice(WeiPerEther, tokens.sUSD, tokens.sEUR)
		expect(price.gt(0)).to.equal(true)
	})

	it('Should check spot price (withdraw)', async function () {
		const price = await synthetixAdapter.spotPrice(WeiPerEther, tokens.sEUR, tokens.sUSD)
		expect(price.gt(0)).to.equal(true)
	})
	it('Should check spot price: same', async function () {
		const price = await synthetixAdapter.spotPrice(WeiPerEther, tokens.sUSD, tokens.sUSD)
		expect(price.eq(WeiPerEther)).to.equal(true)
	})
})
