import hre from 'hardhat'
import { expect } from 'chai'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { EnsoBuilder, EnsoEnvironment } from '../lib/enso'
import { Tokens } from '../lib/tokens'
import { prepareStrategy, InitialState } from '../lib/encode'
import { increaseTime, resetBlockchain, impersonate } from '../lib/utils'
import { initializeTestLogging, logTestComplete } from '../lib/convincer'
import { DIVISOR } from '../lib/constants'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'

const { constants, getSigners, getContractAt, getContractFactory } = hre.ethers
const { AddressZero } = constants

const strategyState: InitialState = {
	timelock: BigNumber.from(60),
	rebalanceThreshold: BigNumber.from(50),
	rebalanceSlippage: BigNumber.from(995),
	restructureSlippage: BigNumber.from(985),
	managementFee: BigNumber.from(0),
	social: true,
	set: false,
}

describe('Estimator', function () {
	let proofCounter: number
	let accounts: SignerWithAddress[],
		enso: EnsoEnvironment,
		tokens: Tokens,
		weth: Contract,
		strategy: Contract,
		metaStrategy: Contract,
		routerAddress: string,
		aaveV2AdapterAddress: string,
		curveAdapterAddress: string,
		curveLPAdapterAddress: string,
		metaStrategyAdapterAddress: string,
		synthetixAdapterAddress: string,
		uniswapV2AdapterAddress: string,
		uniswapV3AdapterAddress: string,
		yearnV2AdapterAddress: string,
		controllerLens: Contract

	before('Setup Enso + Estimator', async function () {
		proofCounter = initializeTestLogging(this, __dirname)

		await resetBlockchain()

		accounts = await getSigners()
		const owner = accounts[0]

		const ensoBuilder = new EnsoBuilder(owner)
		ensoBuilder.addRouter('full')
		ensoBuilder.addAdapter('aaveV2')
		ensoBuilder.addAdapter('balancer')
		ensoBuilder.addAdapter('curve')
		ensoBuilder.addAdapter('curveLP')
		ensoBuilder.addAdapter('metastrategy')
		ensoBuilder.addAdapter('synthetix')
		ensoBuilder.addAdapter('uniswapV2')
		ensoBuilder.addAdapter('uniswapV3')
		ensoBuilder.addAdapter('yearnV2')
		enso = await ensoBuilder.build()

		const { uniswapV3Registry, chainlinkRegistry, curveDepositZapRegistry } = enso.platform.oracles.registries

		tokens = new Tokens()
		await tokens.registerTokens(
			owner,
			enso.platform.strategyFactory,
			uniswapV3Registry,
			chainlinkRegistry,
			curveDepositZapRegistry
		)
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])

		routerAddress = enso.routers[0]?.contract?.address || AddressZero
		aaveV2AdapterAddress = enso.adapters?.aaveV2?.contract?.address || AddressZero
		curveAdapterAddress = enso.adapters?.curve?.contract?.address || AddressZero
		curveLPAdapterAddress = enso.adapters?.curveLP?.contract?.address || AddressZero
		metaStrategyAdapterAddress = enso.adapters?.metastrategy?.contract?.address || AddressZero
		synthetixAdapterAddress = enso.adapters?.synthetix?.contract?.address || AddressZero
		uniswapV2AdapterAddress = enso.adapters?.uniswapV2?.contract?.address || AddressZero
		uniswapV3AdapterAddress = enso.adapters?.uniswapV3?.contract?.address || AddressZero
		yearnV2AdapterAddress = enso.adapters?.yearnV2?.contract?.address || AddressZero

		const StrategyControllerLens = await getContractFactory('StrategyControllerLens')
		controllerLens = await StrategyControllerLens.deploy(
			enso.platform.controller.address,
			weth.address,
			enso.platform.strategyFactory.address
		)
		await controllerLens.deployed()
	})

	it('Should deploy synth strategy', async function () {
		const name = 'Synth Strategy'
		const symbol = 'SYNTH'
		const positions = [
			{ token: tokens.crv, percentage: BigNumber.from(400) },
			{
				token: tokens.sUSD,
				percentage: BigNumber.from(0),
				adapters: [uniswapV2AdapterAddress, curveAdapterAddress],
				path: [tokens.usdc],
			},
			{ token: tokens.sBTC, percentage: BigNumber.from(400), adapters: [synthetixAdapterAddress], path: [] },
			{ token: tokens.sEUR, percentage: BigNumber.from(200), adapters: [synthetixAdapterAddress], path: [] },
		]
		const strategyItems = prepareStrategy(positions, uniswapV3AdapterAddress)

		const depositAmount = BigNumber.from('10000000000000000')
		const estimatedDepositValue = await controllerLens.callStatic.estimateCreateStrategy(
			depositAmount,
			name,
			symbol,
			strategyItems,
			strategyState,
			routerAddress,
			'0x'
		)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())

		const tx = await enso.platform.strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, routerAddress, '0x', { value: depositAmount })
		const receipt = await tx.wait()
		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		strategy = await getContractAt('Strategy', strategyAddress)

		expect(await enso.platform.controller.initialized(strategy.address)).to.equal(true)

		const [total] = await enso.platform.oracles.ensoOracle.estimateStrategy(strategy.address)
		console.log('Actual deposit value: ', total.toString())
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should estimate deposit', async function () {
		await increaseTime(600)
		const [totalBefore] = await enso.platform.oracles.ensoOracle.estimateStrategy(strategy.address)
		const depositAmount = BigNumber.from('10000000000000000')
		const estimatedDepositValue = await controllerLens.callStatic.estimateDeposit(
			strategy.address,
			routerAddress,
			depositAmount,
			0,
			'0x'
		)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await enso.platform.controller
			.connect(accounts[1])
			.deposit(strategy.address, routerAddress, 0, 0, '0x', { value: depositAmount })
		const [totalAfter] = await enso.platform.oracles.ensoOracle.estimateStrategy(strategy.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should deploy lending strategy', async function () {
		const name = 'Lending Strategy'
		const symbol = 'LEND'
		const positions = [
			{
				token: tokens.aUSDC,
				percentage: BigNumber.from(400),
				adapters: [uniswapV3AdapterAddress, aaveV2AdapterAddress],
				path: [tokens.usdc],
			},
			{
				token: tokens.crvSUSD,
				percentage: BigNumber.from(400),
				adapters: [uniswapV2AdapterAddress, curveAdapterAddress, curveLPAdapterAddress],
				path: [tokens.dai, tokens.sUSD],
			},
			{
				token: tokens.yWBTC,
				percentage: BigNumber.from(200),
				adapters: [uniswapV2AdapterAddress, yearnV2AdapterAddress],
				path: [tokens.wbtc],
			},
		]
		const strategyItems = prepareStrategy(positions, uniswapV3AdapterAddress)

		const depositAmount = BigNumber.from('10000000000000000')
		const estimatedDepositValue = await controllerLens.callStatic.estimateCreateStrategy(
			depositAmount,
			name,
			symbol,
			strategyItems,
			strategyState,
			routerAddress,
			'0x'
		)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())

		const tx = await enso.platform.strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, routerAddress, '0x', { value: depositAmount })
		const receipt = await tx.wait()
		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		strategy = await getContractAt('Strategy', strategyAddress)

		expect(await enso.platform.controller.initialized(strategy.address)).to.equal(true)

		const [total] = await enso.platform.oracles.ensoOracle.estimateStrategy(strategy.address)
		console.log('Actual deposit value: ', total.toString())
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should estimate withdraw', async function () {
		const withdrawAmount = (await strategy.balanceOf(accounts[1].address)).div(2)
		const wethBefore = await weth.balanceOf(accounts[1].address)
		await strategy.connect(accounts[1]).approve(controllerLens.address, withdrawAmount)
		const estimatedWithdrawValue = await controllerLens
			.connect(
				await impersonate(accounts[1].address) // just emphasizing we impersonate to estimate
			)
			.callStatic.estimateWithdrawWETH(strategy.address, routerAddress, withdrawAmount, 0, '0x')
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
		const slippage = BigNumber.from(estimatedWithdrawValue).mul(DIVISOR).div(withdrawAmount).sub(1) // subtract 1 for margin of error
		await enso.platform.controller
			.connect(accounts[1])
			.withdrawWETH(strategy.address, routerAddress, withdrawAmount, slippage, '0x')
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should deploy meta strategy', async function () {
		const name = 'Meta Strategy'
		const symbol = 'META'
		const positions = [
			{
				token: strategy.address,
				percentage: BigNumber.from(500),
				adapters: [metaStrategyAdapterAddress],
				path: [],
			},
			{ token: tokens.crv, percentage: BigNumber.from(250), adapters: [uniswapV2AdapterAddress], path: [] },
			{ token: tokens.yfi, percentage: BigNumber.from(250), adapters: [uniswapV2AdapterAddress], path: [] },
		]
		const strategyItems = prepareStrategy(positions, uniswapV3AdapterAddress)

		const depositAmount = BigNumber.from('10000000000000000')
		const estimatedDepositValue = await controllerLens.callStatic.estimateCreateStrategy(
			depositAmount,
			name,
			symbol,
			strategyItems,
			strategyState,
			routerAddress,
			'0x'
		)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())

		const tx = await enso.platform.strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, routerAddress, '0x', {
				value: depositAmount,
			})
		const receipt = await tx.wait()
		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		metaStrategy = await getContractAt('Strategy', strategyAddress)

		expect(await enso.platform.controller.initialized(strategy.address)).to.equal(true)

		const [total] = await enso.platform.oracles.ensoOracle.estimateStrategy(metaStrategy.address)
		console.log('Actual deposit value: ', total.toString())
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should estimate withdraw', async function () {
		const withdrawAmount = (await metaStrategy.balanceOf(accounts[1].address)).div(2)
		const wethBefore = await weth.balanceOf(accounts[1].address)
		await metaStrategy.connect(accounts[1]).approve(controllerLens.address, withdrawAmount)
		const estimatedWithdrawValue = await controllerLens
			.connect(
				await impersonate(accounts[1].address) // just emphasizing we impersonate to estimate
			)
			.callStatic.estimateWithdrawWETH(metaStrategy.address, routerAddress, withdrawAmount, 0, '0x')
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
		let slippage = BigNumber.from(estimatedWithdrawValue).mul(DIVISOR).div(withdrawAmount).sub(1) // subtract 1 for margin of error
		if (slippage.gt(999)) slippage = BigNumber.from(999)
		await enso.platform.controller
			.connect(accounts[1])
			.withdrawWETH(metaStrategy.address, routerAddress, withdrawAmount, slippage, '0x')
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
		logTestComplete(this, __dirname, proofCounter++)
	})
})
