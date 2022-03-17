import chai from 'chai'
//const { expect } = chai
import { ethers } from 'hardhat'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero/*, WeiPerEther*/ } = constants
import { solidity } from 'ethereum-waffle'
import { /*BigNumber,*/ Contract/*, Event*/ } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
//import { prepareStrategy, StrategyItem, InitialState } from '../lib/encode'

import { Tokens } from '../lib/tokens'

import {
	deployEnsoToken,
  deployEnsoStakingAdapter,
	deployPlatform,
	//deployLoopRouter // FIXME ??
  // anything else // FIXME
} from '../lib/deploy'

import { MAINNET_ADDRESSES } from '../lib/utils'
// import { displayBalances } from '../lib/logging'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'

chai.use(solidity)

describe('EnsoStakingAdapter', function () {
  
	let	weth: Contract,
    usdc: Contract,
		accounts: SignerWithAddress[],
    ensoToken: Contract,
    distributionToken: Contract,
    stakingMock: Contract,
    ensoStakingAdapter: Contract,
    distributionTokenScalar: number,
		uniswapFactory: Contract,
		//router: Contract,
		//strategyFactory: Contract,
		//controller: Contract,
		//oracle: Contract,
		//library: Contract,
		//uniswapAdapter: Contract,
		//compoundAdapter: Contract,
		//strategy: Contract,
		//strategyItems: StrategyItem[],
		//wrapper: Contract,
		tokens: Tokens//,
		//cToken: string
    

	before('Setup StakingAdapter + Factory', async function () {
	  accounts = await getSigners()
    tokens = new Tokens()
    weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
    usdc = new Contract(tokens.usdc, ERC20.abi, accounts[0])
    distributionToken = usdc
    
    ensoToken = await deployEnsoToken(accounts[0], accounts[0], "EnsoToken", "ENS", Date.now())
    
    const StakingMockFactory = await getContractFactory('StakingMock')
    stakingMock = await StakingMockFactory.deploy(ensoToken.address)
    await stakingMock.deployed()
    
    distributionTokenScalar = 10
    ensoStakingAdapter = await deployEnsoStakingAdapter(accounts[0], stakingMock, ensoToken, distributionToken, distributionTokenScalar, weth)
    
    uniswapFactory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, accounts[0])
    const platform = await deployPlatform(accounts[0], uniswapFactory, new Contract(AddressZero, [], accounts[0]), weth)
    const whitelist = platform.administration.whitelist
    await whitelist.connect(accounts[0]).approve(ensoStakingAdapter.address)
	})

	it('Should deploy strategy', async function () {
    /*
		cToken = tokens.cUSDC

		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: weth.address, percentage: BigNumber.from(500) },
			{ token: cToken, percentage: BigNumber.from(500), adapters: [uniswapAdapter.address, compoundAdapter.address], path: [tokens.usdc] }
		]
		strategyItems = prepareStrategy(positions, uniswapAdapter.address)
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

		// await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
    */
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
    /*
		// Approve the user to use the adapter
		const value = WeiPerEther.mul(1000)
		await weth.connect(accounts[19]).deposit({value: value})
		await weth.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, weth.address, usdc.address, accounts[19].address, accounts[19].address)

		// await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
    */
	})

	it('Should rebalance strategy', async function () {
    /*
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		// await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
    */
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
    /*
		// Approve the user to use the adapter
		const value = await usdc.balanceOf(accounts[19].address)
		await usdc.connect(accounts[19]).approve(uniswapAdapter.address, value)
		await uniswapAdapter
			.connect(accounts[19])
			.swap(value, 0, usdc.address, weth.address, accounts[19].address, accounts[19].address)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
    */
	})

	it('Should rebalance strategy', async function () {
    /*
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
    */
	})

	it('Should claim rewards', async function() {
    /*
		await strategy.connect(accounts[1]).claimRewards(compoundAdapter.address, cToken)
    */
	})

	it('Should check spot price (deposit)', async function () {
    /*
		const price = await compoundAdapter.spotPrice(WeiPerEther, tokens.usdc, tokens.cUSDC)
		expect(price.gt(0)).to.equal(true)
    */
	})

	it('Should check spot price (withdraw)', async function () {
    /*
		const price = await compoundAdapter.spotPrice(WeiPerEther, tokens.cUSDC, tokens.usdc)
		expect(price.gt(0)).to.equal(true)
    */
	})

	it('Should check spot price: same', async function () {
    /*
		const price = await compoundAdapter.spotPrice(WeiPerEther, tokens.cUSDC, tokens.cUSDC)
		expect(price.eq(WeiPerEther)).to.equal(true)
    */
	})

	it('Should check spot price: zero', async function () {
    /*
		const price = await compoundAdapter.spotPrice(WeiPerEther, tokens.usdc, weth.address)
		expect(price.eq(0)).to.equal(true)
    */
	})
})
