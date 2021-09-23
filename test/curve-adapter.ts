import chai from 'chai'
const { expect } = chai
import { ethers } from 'hardhat'
const { constants, getContractFactory, getSigners } = ethers
const { WeiPerEther, AddressZero } = constants
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { prepareStrategy, StrategyItem, StrategyState } from '../lib/encode'
import { Tokens } from '../lib/tokens'
import {
	deployCurveLPAdapter,
	deployCurveRewardsAdapter,
	deployUniswapV2Adapter,
	deployPlatform,
	deployLoopRouter
} from '../lib/deploy'
import { MAINNET_ADDRESSES } from '../lib/utils'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'

chai.use(solidity)

describe('CurveLPAdapter + CurveRewardsAdapter', function () {
	let	weth: Contract,
		crv: Contract,
		//dai: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		uniswapAdapter: Contract,
		curveLPAdapter: Contract,
		curveRewardsAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		tokens: Tokens,
		rewardToken: string

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		crv = new Contract(tokens.crv, ERC20.abi, accounts[0])
		//dai = new Contract(tokens.crv.dai, ERC20.abi, accounts[0])
		uniswapFactory = new Contract(MAINNET_ADDRESSES.UNISWAP, UniswapV2Factory.abi, accounts[0])
		const platform = await deployPlatform(accounts[0], uniswapFactory, weth)
		strategyFactory = platform.strategyFactory
		controller = platform.controller
		oracle = platform.oracles.ensoOracle

		await tokens.registerTokens(accounts[0], strategyFactory)

		const chainlinkOracle = platform.oracles.protocols.chainlinkOracle
		const curvePoolRegistry = platform.oracles.registries.curvePoolRegistry
		const whitelist = platform.administration.whitelist

		router = await deployLoopRouter(accounts[0], controller)
		await whitelist.connect(accounts[0]).approve(router.address)
		uniswapAdapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
		await whitelist.connect(accounts[0]).approve(uniswapAdapter.address)
		curveLPAdapter = await deployCurveLPAdapter(accounts[0], curvePoolRegistry, weth)
		await whitelist.connect(accounts[0]).approve(curveLPAdapter.address)
		curveRewardsAdapter = await deployCurveRewardsAdapter(accounts[0], curvePoolRegistry, weth)
		await whitelist.connect(accounts[0]).approve(curveRewardsAdapter.address)

		// Add chainlink oracle
		await chainlinkOracle.addOracle(tokens.slink, weth.address, '0xDC530D9457755926550b59e8ECcdaE7624181557', false);
		// Add curve pools
		await curvePoolRegistry.addPool('0x7Eb40E450b9655f4B3cC4259BCC731c63ff55ae6', '0x3c8cAee4E09296800f8D29A68Fa3837e2dae4940', '0x42d7025938bEc20B69cBae5A77421082407f053A', '0x055be5DDB7A925BfEF3417FC157f53CA77cA7222', false); //crvusdp
		await curvePoolRegistry.addPool('0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490', '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A', false); //crv3
		await curvePoolRegistry.addPool('0xC25a3A3b969415c80451098fa907EC722572917F', '0xfcba3e75865d2d561be8d220616520c171f12851', '0xA5407eAE9Ba41422680e2e00537571bcC53efBfD', '0xA90996896660DEcC6E997655E065b23788857849', true); //crvsusd
		await curvePoolRegistry.addPool('0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900', '0xDeBF20617708857ebe4F679508E7b7863a8A8EeE', '0xDeBF20617708857ebe4F679508E7b7863a8A8EeE', '0xd662908ADA2Ea1916B3318327A97eB18aD588b5d', false); //crvaave
		await curvePoolRegistry.addPool('0xcee60cfa923170e4f8204ae08b4fa6a3f5656f3a', '0xf178c0b5bb7e7abf4e12a4838c7b7c5ba2c623c0', '0xf178c0b5bb7e7abf4e12a4838c7b7c5ba2c623c0', '0xFD4D8a17df4C27c1dD245d153ccf4499e806C87D', false); //crvlink
	})

	/*
	it('Should test curve', async function () {
		await weth.connect(accounts[0]).deposit({value: WeiPerEther})            console.log("Virtual price: ", virtualPrice);

		await weth.connect(accounts[0]).approve(curveLPAdapter.address, WeiPerEther)
		await curveLPAdapter.connect(accounts[0]).swap(WeiPerEther, 0, weth.address, tokens.crv3, accounts[0].address, accounts[0].address)
	})

	it('Should test curve reward', async function () {
		await weth.connect(accounts[0]).deposit({value: WeiPerEther})
		await weth.connect(accounts[0]).approve(curveRewardsAdapter.address, WeiPerEther)
		await curveRewardsAdapter.connect(accounts[0]).swap(WeiPerEther, 0, weth.address, tokens.crvLINKGauge, accounts[0].address, accounts[0].address)
	})
	*/

	it('Should deploy strategy', async function () {
		rewardToken = tokens.crvLINKGauge
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(0) },
			{ token: crv.address, percentage: BigNumber.from(500) },
			{ token: rewardToken,
				percentage: BigNumber.from(500),
				adapters: [uniswapAdapter.address, curveLPAdapter.address, curveRewardsAdapter.address],
				path: [tokens.link, tokens.crvLINK]
			}
		]
		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
		const strategyState: StrategyState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			slippage: BigNumber.from(995),
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

		//await displayBalances(wrapper, strategyTokens, weth)
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

		//await displayBalances(wrapper, strategyTokens, weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		// Approve the user to use the adapter
		const value = await crv.balanceOf(accounts[19].address)
		await crv.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, crv.address, weth.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyTokens, weth)
		expect(await wrapper.isBalanced()).to.equal(false)
	})

	it('Should rebalance strategy', async function () {
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyTokens, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
	})

	it('Should claim rewards', async function() {
		await strategy.connect(accounts[1]).delegateClaimRewards(curveRewardsAdapter.address, rewardToken)
	})

	it('Should check reward spot price', async function () {
		const price = await curveRewardsAdapter.spotPrice(WeiPerEther, AddressZero, AddressZero)
		expect(price.eq(WeiPerEther)).to.equal(true)
	})

	it('Should check lp spot price (withdraw)', async function () {
		const price = await curveLPAdapter.spotPrice(WeiPerEther, tokens.crvLINK, tokens.link)
		expect(price.gt(0)).to.equal(true)
	})

	it('Should check lp spot price (deposit)', async function () {
		const price = await curveLPAdapter.spotPrice(WeiPerEther, tokens.link, tokens.crvLINK)
		expect(price.gt(0)).to.equal(true)
	})

	it('Should check spot price: same', async function () {
		const price = await curveLPAdapter.spotPrice(WeiPerEther, rewardToken, rewardToken)
		expect(price.eq(WeiPerEther)).to.equal(true)
	})
})
