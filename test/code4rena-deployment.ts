import hre from 'hardhat'
import chai from 'chai'
const { expect } = chai
import { BigNumber, Contract, Event } from 'ethers'
//import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { solidity } from 'ethereum-waffle'
const { ethers } = hre
const { getContractFactory, getSigners } = ethers
import { deployCode4renaFixes } from '../scripts/code-4rena-deploy'
import { transferOwnershipTokenRegistry } from '../scripts/transferownership-tokenregistry'
//import { registerTokens } from '../scripts/register-token'
import { Tokens } from '../lib/tokens'
import { prepareStrategy, StrategyItem, InitialState/*, TradeData*/ } from '../lib/encode'

import { initializeTestLogging, logTestComplete } from '../lib/convincer'

chai.use(solidity)
describe('Code4rena deployment', function () {
	let proofCounter: number,
    contracts: { [key: string]: string },
    tokens: Tokens,
	/*	weth: Contract,
		crv: Contract,
		dai: Contract,
    */
		accounts: SignerWithAddress[],
		router: Contract,
    
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
    /*
		whitelist: Contract,
		controllerLibrary: Contract,
    */
		uniswapV2Adapter: Contract,
		uniswapV3Adapter: Contract,
		compoundAdapter: Contract,
		//curveAdapter: Contract,
		curveLPAdapter: Contract,
		curveGaugeAdapter: Contract,
    /*
		crvLINKGauge: string,
		rewardsToken: Contract,
		stakingRewards: Contract,
    */
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract

	before('Deploy new contracts.', async function () {
		proofCounter = initializeTestLogging(this, __dirname)

		accounts = await getSigners()
	})

	it('Should deployCode4renaFixes', async function () {
    contracts = await deployCode4renaFixes()
    console.log(contracts)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should transferOwnershipTokenRegistry', async function () {
    await transferOwnershipTokenRegistry()
		logTestComplete(this, __dirname, proofCounter++)
	})

	/*it('Should registerTokens', async function () {
    tokens = await registerTokens()
    console.log(tokens)
		logTestComplete(this, __dirname, proofCounter++)
	})*/

  // TODO mimic live-estimates

  // deploy exotic strategy etc
	it('Should deploy "exotic" strategy', async function () {
	  controller = new Contract(contracts['StrategyController'], (await getContractFactory('StrategyController')).interface, accounts[0])
    oracle = new Contract(contracts['EnsoOracle'], (await getContractFactory('EnsoOracle')).interface, accounts[0])
    strategyFactory = new Contract(contracts['StrategyProxyFactory'], (await getContractFactory('StrategyProxyFactory')).interface, accounts[0])
    router = new Contract(contracts['LoopRouter'], (await getContractFactory('LoopRouter')).interface, accounts[0])

		uniswapV2Adapter = new Contract(contracts['UniswapV2Adapter'], (await getContractFactory('UniswapV2Adapter')).interface, accounts[0])
		uniswapV3Adapter = new Contract(contracts['UniswapV3Adapter'], (await getContractFactory('UniswapV3Adapter')).interface, accounts[0])
		compoundAdapter = new Contract(contracts['CompoundAdapter'], (await getContractFactory('CompoundAdapter')).interface, accounts[0])
		curveLPAdapter = new Contract(contracts['CurveLPAdapter'], (await getContractFactory('CurveLPAdapter')).interface, accounts[0])
		curveGaugeAdapter = new Contract(contracts['CurveGaugeAdapter'], (await getContractFactory('CurveGaugeAdapter')).interface, accounts[0])

		const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			// an "exotic" strategy
			{ token: tokens.dai, percentage: BigNumber.from(200) },
			{ token: tokens.crv, percentage: BigNumber.from(0) },
			{
				token: tokens.crvEURS,
				percentage: BigNumber.from(200),
				adapters: [uniswapV3Adapter.address, uniswapV3Adapter.address, curveLPAdapter.address],
				path: [tokens.usdc, tokens.eurs],
			},
			{
				token: tokens.crvLINKGauge,
				percentage: BigNumber.from(400),
				adapters: [uniswapV2Adapter.address, curveLPAdapter.address, curveGaugeAdapter.address],
				path: [tokens.link, tokens.crvLINK],
			},
			{
				token: tokens.cUSDT,
				percentage: BigNumber.from(100),
				adapters: [uniswapV2Adapter.address, compoundAdapter.address],
				path: [tokens.usdt],
			},
			{
				token: tokens.cDAI,
				percentage: BigNumber.from(100),
				adapters: [uniswapV2Adapter.address, compoundAdapter.address],
				path: [tokens.dai],
			},
		]
		strategyItems = prepareStrategy(positions, uniswapV2Adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(980), //Slippage is set low because of low-liquidity in EURS' UniV2 pool
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}
		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		//const Strategy = await platform.getStrategyContractFactory()
    const Strategy = await hre.ethers.getContractFactory('Strategy', {
      libraries: {
        StrategyClaim: contracts['StrategyClaim'],
      },
    })
		strategy = await Strategy.attach(strategyAddress)
    strategy=strategy // debug

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: contracts['StrategyLibrary'],
				ControllerLibrary: contracts['ControllerLibrary'],
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})
})
