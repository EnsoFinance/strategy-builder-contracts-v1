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
	deployKyberSwapAdapter,
	deployUniswapV2Adapter,
	deployPlatform,
	deployLoopRouter
} from '../lib/deploy'
import { MAINNET_ADDRESSES } from '../lib/constants'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import UniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import IDMMFactory from '../artifacts/contracts/interfaces/kyber/IDMMFactory.sol/IDMMFactory.json'
import IDMMRouter02 from '../artifacts/contracts/interfaces/kyber/IDMMRouter02.sol/IDMMRouter02.json'

chai.use(solidity)

describe('KyberSwapAdapter', function () {
	let	weth: Contract,
		dai: Contract,
		knc: Contract,
		accounts: SignerWithAddress[],
		owner: SignerWithAddress,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		whitelist: Contract,
		library: Contract,
		kyberAdapter: Contract,
		uniswapV2Adapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		tokens: Tokens

	before('Setup Kyber + factory', async function () {
		accounts = await getSigners()
		owner = accounts[0]
		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, owner)
		dai = new Contract(tokens.dai, ERC20.abi, owner)
		knc = new Contract(tokens.knc, ERC20.abi, owner)

		const kyberFactory = new Contract(MAINNET_ADDRESSES.KYBER_FACTORY, IDMMFactory.abi, owner)
		const kyberRouter = new Contract(MAINNET_ADDRESSES.KYBER_ROUTER, IDMMRouter02.abi, owner)
		const uniswapV2Factory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, owner)
		const uniswapV3Factory = new Contract(MAINNET_ADDRESSES.UNISWAP_V3_FACTORY, UniswapV3Factory.abi, owner)

		const platform = await deployPlatform(owner, uniswapV2Factory, uniswapV3Factory, weth, undefined)
		strategyFactory = platform.strategyFactory
		controller = platform.controller
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		library = platform.library

		const { curveDepositZapRegistry, chainlinkRegistry, uniswapV3Registry } = platform.oracles.registries
		await tokens.registerTokens(owner, strategyFactory, uniswapV3Registry, chainlinkRegistry, curveDepositZapRegistry)



		router = await deployLoopRouter(owner, controller, library)
		await whitelist.connect(owner).approve(router.address)
		kyberAdapter = await deployKyberSwapAdapter(owner, kyberFactory, kyberRouter, weth)
		await whitelist.connect(owner).approve(kyberAdapter.address)
		uniswapV2Adapter = await deployUniswapV2Adapter(owner, uniswapV2Factory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapV2Adapter.address)
	})

	it('Should deploy strategy', async function () {
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: knc.address, percentage: BigNumber.from(500), adapters: [kyberAdapter.address], path: [] },
			{ token: dai.address, percentage: BigNumber.from(500) }
		]
		strategyItems = prepareStrategy(positions, uniswapV2Adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			rebalanceSlippage: BigNumber.from(995),
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

	it('Should deposit', async function () {
		const tx = await controller.connect(accounts[1]).deposit(strategy.address, router.address, 0, '990', '0x', { value: WeiPerEther })
		const receipt = await tx.wait()
		console.log('Deposit Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(500)
		await weth.connect(accounts[19]).deposit({value: value})
		await weth.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, dai.address, accounts[19].address, accounts[19].address)

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

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = await dai.balanceOf(accounts[19].address)
		await dai.connect(accounts[19]).approve(uniswapV2Adapter.address, value)
		await uniswapV2Adapter
			.connect(accounts[19])
			.swap(value, 0, dai.address, weth.address, accounts[19].address, accounts[19].address)

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

	it('Should withdraw ETH', async function () {
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const amount = (await strategy.balanceOf(accounts[1].address)).div(2)
		const ethBalanceBefore = await accounts[1].getBalance()
		const tx = await controller.connect(accounts[1]).withdrawETH(strategy.address, router.address, amount, '990', '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		const ethBalanceAfter = await accounts[1].getBalance()
		expect(ethBalanceAfter.gt(ethBalanceBefore)).to.equal(true)
	})
})
