import chai from 'chai'
const { expect } = chai
import hre from 'hardhat'
import { ethers } from 'hardhat'
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
import { solidity } from 'ethereum-waffle'
import { BigNumber, Contract, Event } from 'ethers'
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
//import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
//import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
//import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
//import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'

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
		//compoundAdapter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract,
		tokens: Tokens//,
		//cToken: string
    

	before('Setup StakingAdapter + Factory', async function () {
		  accounts = await getSigners()
	    tokens = new Tokens()
      let tokens_ = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))

      weth = tokens_[0]
	    usdc = tokens_[1] 

	    ensoToken = await deployEnsoToken(accounts[0], accounts[0], "EnsoToken", "ENS", Date.now())
	    const StakingMockFactory = await getContractFactory('StakingMock')
	    stakingMock = await StakingMockFactory.deploy(ensoToken.address)
	    await stakingMock.deployed()
	    sEnso = stakingMock 
	    
	    ensoStakingAdapter = await deployEnsoStakingAdapter(accounts[0], stakingMock, ensoToken, sEnso, weth)
	    
      uniswapFactory = await deployUniswapV2(accounts[0], [weth, ensoToken, usdc])
      
	    const platform = await deployPlatform(accounts[0], uniswapFactory, new Contract(AddressZero, [], accounts[0]), weth, sEnso)
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
     
    await hre.network.provider.send("evm_mine", ["0x100"]);

		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
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

    strategy=strategy // debug may use later

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
   /* 
		expect(await wrapper.isBalanced()).to.equal(true)
    
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
    // FIXME reverting with unrecognized systme error
    console.log(sEnso.address);
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
    
		const price = await ensoStakingAdapter.spotPrice(WeiPerEther, ensoToken.address, sEnso.address)
		expect(price.gt(0)).to.equal(true)
    
	})

	it('Should check spot price (withdraw)', async function () {
    
		const price = await ensoStakingAdapter.spotPrice(WeiPerEther, sEnso.address, ensoToken.address)
		expect(price.gt(0)).to.equal(true)
   
	})

	it('Should fail check spot price: same', async function () {
    
		await expect(ensoStakingAdapter.spotPrice(WeiPerEther, sEnso.address, sEnso.address)).to.be.revertedWith("spotPrice: tokens cannot match.")
    
	})

	it('Should fail check spot price: non enso or sEnso', async function () {
    
		await expect(ensoStakingAdapter.spotPrice(WeiPerEther, sEnso.address, tokens.usdc)).to.be.revertedWith("spotPrice: invalid `tokenOut`.")
		await expect(ensoStakingAdapter.spotPrice(WeiPerEther, tokens.usdc, sEnso.address)).to.be.revertedWith("spotPrice: invalid `tokenIn`.")
    
	})

	it('Should check spot price: zero', async function () {
    
		const price = await ensoStakingAdapter.spotPrice(0, ensoToken.address, sEnso.address)
		expect(price.eq(0)).to.equal(true)
    
	})
})
