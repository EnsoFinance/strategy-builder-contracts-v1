import chai from 'chai'
const { expect } = chai
import { ethers } from 'hardhat'
const { constants, getContractFactory, getSigners } = ethers
const { WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { prepareStrategy, StrategyItem, InitialState } from '../lib/encode'
import { Tokens } from '../lib/tokens'
import {
	deployYEarnAdapter,
	deployCurveAdapter,
	deployCurveLPAdapter,
	deployUniswapV2Adapter,
	deployUniswapV3Adapter,
	deployPlatform,
	deployLoopRouter
} from '../lib/deploy'
import { MAINNET_ADDRESSES } from '../lib/constants'
//import { displayBalances } from '../lib/logging'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import UniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'

chai.use(solidity)

describe('YEarnV2Adapter', function () {
	let	weth: Contract,
		crv: Contract,
		//dai: Contract,
		accounts: SignerWithAddress[],
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		library: Contract,
		uniswapV2Adapter: Contract,
		uniswapV3Adapter: Contract,
		curveAdapter: Contract,
		curveLPAdapter: Contract,
		yearnAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		tokens: Tokens

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		crv = new Contract(tokens.crv, ERC20.abi, accounts[0])
		//dai = new Contract(tokens.crv.dai, ERC20.abi, accounts[0])
		const uniswapV2Factory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, accounts[0])
		const uniswapV3Factory = new Contract(MAINNET_ADDRESSES.UNISWAP_V3_FACTORY, UniswapV3Factory.abi, accounts[0])
		const platform = await deployPlatform(accounts[0], uniswapV2Factory, uniswapV3Factory, weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		library = platform.library

		const { curveDepositZapRegistry, chainlinkRegistry, uniswapV3Registry } = platform.oracles.registries
		await tokens.registerTokens(accounts[0], strategyFactory, uniswapV3Registry, chainlinkRegistry, curveDepositZapRegistry)

		const addressProvider = new Contract(MAINNET_ADDRESSES.CURVE_ADDRESS_PROVIDER, [], accounts[0])
		const whitelist = platform.administration.whitelist
		router = await deployLoopRouter(accounts[0], controller, library)
		await whitelist.connect(accounts[0]).approve(router.address)
		uniswapV2Adapter = await deployUniswapV2Adapter(accounts[0], uniswapV2Factory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapV2Adapter.address)
		uniswapV3Adapter = await deployUniswapV3Adapter(accounts[0], uniswapV3Registry, new Contract(MAINNET_ADDRESSES.UNISWAP_V3_ROUTER, [], accounts[0]), weth)
		await whitelist.connect(accounts[0]).approve(uniswapV3Adapter.address)
		curveAdapter = await deployCurveAdapter(accounts[0], addressProvider, weth)
		await whitelist.connect(accounts[0]).approve(curveAdapter.address)
		curveLPAdapter = await deployCurveLPAdapter(accounts[0], addressProvider, curveDepositZapRegistry, weth)
		await whitelist.connect(accounts[0]).approve(curveLPAdapter.address)
		yearnAdapter = await deployYEarnAdapter(accounts[0], weth)
		await whitelist.connect(accounts[0]).approve(yearnAdapter.address)
	})

	it('Should deploy strategy', async function () {
		const yearnToken = tokens.ycrvSUSD

		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(0) },
			{ token: crv.address, percentage: BigNumber.from(500) },
			{ token: yearnToken,
				percentage: BigNumber.from(500),
				adapters: [uniswapV3Adapter.address, curveAdapter.address, curveLPAdapter.address, yearnAdapter.address],
				path: [tokens.usdc, tokens.sUSD, tokens.crvSUSD]
			}
		]
		strategyItems = prepareStrategy(positions, uniswapV2Adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(995),
			restructureSlippage: BigNumber.from(985),
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

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(100)
		await weth.connect(accounts[19]).deposit({value: value})
		await weth.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, crv.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyTokens, weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = await crv.balanceOf(accounts[19].address)
		await crv.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, crv.address, weth.address, accounts[19].address, accounts[19].address)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		expect(await wrapper.isBalanced()).to.equal(true)
	})
})
