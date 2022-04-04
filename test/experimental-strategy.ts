import chai from 'chai'
const { expect } = chai
import { ethers } from 'hardhat'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { prepareStrategy, StrategyItem, InitialState } from '../lib/encode'
import { Tokens } from '../lib/tokens'
import {
	deployAaveLendAdapter,
	deployAaveBorrowAdapter,
	deployUniswapV2Adapter,
	deployCurveLPAdapter,
	deployYEarnAdapter,
	deployPlatform,
	deployFullRouter
} from '../lib/deploy'
import { MAINNET_ADDRESSES, DEFAULT_DEPOSIT_SLIPPAGE } from '../lib/constants'
//import { displayBalances } from '../lib/logging'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'

chai.use(solidity)

describe('Experimental Strategy', function () {
	let	weth: Contract,
		crv: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		library: Contract,
		uniswapV2Adapter: Contract,
		curveLPAdapter: Contract,
		yearnAdapter: Contract,
		aaveLendAdapter: Contract,
		aaveBorrowAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		tokens: Tokens

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		crv = new Contract(tokens.crv, ERC20.abi, accounts[0])
		uniswapFactory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, accounts[0])
		const platform = await deployPlatform(accounts[0], uniswapFactory, new Contract(AddressZero, [], accounts[0]), weth, new Contract(tokens.sUSD, ERC20.abi, accounts[0]))
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		library = platform.library
		const whitelist = platform.administration.whitelist
		const curveAddressProvider = new Contract(MAINNET_ADDRESSES.CURVE_ADDRESS_PROVIDER, [], accounts[0])
		const aaveAddressProvider = new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], accounts[0])

		const { curveDepositZapRegistry, chainlinkRegistry } = platform.oracles.registries
		await tokens.registerTokens(accounts[0], strategyFactory, undefined, chainlinkRegistry, curveDepositZapRegistry)

		router = await deployFullRouter(accounts[0], aaveAddressProvider, controller, library)
		await whitelist.connect(accounts[0]).approve(router.address)
		uniswapV2Adapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapV2Adapter.address)
		curveLPAdapter = await deployCurveLPAdapter(accounts[0], curveAddressProvider, curveDepositZapRegistry, weth)
		await whitelist.connect(accounts[0]).approve(curveLPAdapter.address)
		yearnAdapter = await deployYEarnAdapter(accounts[0], weth)
		await whitelist.connect(accounts[0]).approve(yearnAdapter.address)
		aaveLendAdapter = await deployAaveLendAdapter(accounts[0], aaveAddressProvider, controller, weth)
		await whitelist.connect(accounts[0]).approve(aaveLendAdapter.address)
		aaveBorrowAdapter = await deployAaveBorrowAdapter(accounts[0], aaveAddressProvider, weth)
		await whitelist.connect(accounts[0]).approve(aaveBorrowAdapter.address)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens.aCRV,
				percentage: BigNumber.from(1000),
				adapters: [uniswapV2Adapter.address, aaveLendAdapter.address],
				path: [crv.address],
			},
			{ token: tokens.debtWETH,
				percentage: BigNumber.from(-400),
				adapters: [aaveBorrowAdapter.address, curveLPAdapter.address, yearnAdapter.address],
				path: [tokens.weth, tokens.crvTriCrypto2, tokens.ycrvTriCrypto2]
			},
			{ token: tokens.ycrvTriCrypto2,
				percentage: BigNumber.from(400),
				adapters: [],
				path: [],
			},
		]
		strategyItems = prepareStrategy(positions, uniswapV2Adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(990),
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
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategy.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(10)
		await weth.connect(accounts[19]).deposit({value: value})
		await weth.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, tokens.crv, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should withdraw', async function () {
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const amount = BigNumber.from('10000000000000000')
		const wethBalanceBefore = await weth.balanceOf(accounts[1].address)
		const tx = await controller.connect(accounts[1]).withdrawWETH(strategy.address, router.address, amount, DEFAULT_DEPOSIT_SLIPPAGE, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const wethBalanceAfter = await weth.balanceOf(accounts[1].address)
		expect(wethBalanceAfter.gt(wethBalanceBefore)).to.equal(true)
	})
})
