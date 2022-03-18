import chai from 'chai'
//const { expect } = chai
import { ethers } from 'hardhat'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract/*, Event*/ } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { prepareStrategy, StrategyItem, InitialState } from '../lib/encode'

import { Tokens } from '../lib/tokens'

import {
  deployTokens,
	deployEnsoToken,
  deployEnsoStakingAdapter,
	deployPlatform,
	deployLoopRouter,
  deployUniswapV2Adapter,
  deployUniswapV2,
} from '../lib/deploy'

//import { MAINNET_ADDRESSES } from '../lib/utils'
// import { displayBalances } from '../lib/logging'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
//import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
//import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
//import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'

chai.use(solidity)

let NUM_TOKENS = 2 

describe('EnsoStakingAdapter', function () {
  
	let	weth: Contract,
    usdc: Contract,
		accounts: SignerWithAddress[],
    ensoToken: Contract,
    distributionToken: Contract,
    stakingMock: Contract,
    ensoStakingAdapter: Contract,
    distributionTokenScalar: number,
    rewardsToken: Contract,
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		library: Contract,
		uniswapAdapter: Contract,
		//compoundAdapter: Contract,
		//strategy: Contract,
		strategyItems: StrategyItem[],
		//wrapper: Contract,
		tokens: Tokens//,
		//cToken: string
    

	before('Setup StakingAdapter + Factory', async function () {
		  accounts = await getSigners()
	    tokens = new Tokens()
      let tokens_ = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))

      weth = tokens_[0]
	    usdc = new Contract(tokens.usdc, ERC20.abi, accounts[0])
      rewardsToken = usdc

      rewardsToken=rewardsToken // debug will be used in tests
	    
	    ensoToken = await deployEnsoToken(accounts[0], accounts[0], "EnsoToken", "ENS", Date.now())
	    
	    const StakingMockFactory = await getContractFactory('StakingMock')
	    stakingMock = await StakingMockFactory.deploy(ensoToken.address)
	    await stakingMock.deployed()
	    distributionToken = stakingMock 
	    
	    distributionTokenScalar = 10
	    ensoStakingAdapter = await deployEnsoStakingAdapter(accounts[0], stakingMock, ensoToken, distributionToken, distributionTokenScalar, weth)
	    
      uniswapFactory = await deployUniswapV2(accounts[0], [weth, ensoToken])
      console.log(uniswapFactory.address);
      
	    const platform = await deployPlatform(accounts[0], uniswapFactory, new Contract(AddressZero, [], accounts[0]), weth)
      const whitelist = platform.administration.whitelist
	    await whitelist.connect(accounts[0]).approve(ensoStakingAdapter.address)

      controller = platform.controller
      strategyFactory = platform.strategyFactory
      oracle = platform.oracles.ensoOracle
      library = platform.library
      
      await tokens.registerTokens(accounts[0], strategyFactory)
      router = await deployLoopRouter(accounts[0], controller, library)
      await whitelist.connect(accounts[0]).approve(router.address) 

      oracle=oracle // debug will be used in tests??
      
      uniswapAdapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, weth)
      await whitelist.connect(accounts[0]).approve(uniswapAdapter.address) 
      await ensoToken.approve(uniswapAdapter.address, constants.MaxUint256)
	})

	it('Should deploy strategy', async function () {
     
    console.log("start of test block debug");
		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
      { token: distributionToken.address, percentage: BigNumber.from(1000), adapters: [uniswapAdapter.address, ensoStakingAdapter.address], path: [ensoToken.address] }
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

    // debug console.log(name, value, strategyState, strategyItems, symbol)
    //
    /*
    *https://discordapp.com/channels/@me/949000054394466344/954093797137076275
    * */
    
    console.log("before createStrategy debug");
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
    /*
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
