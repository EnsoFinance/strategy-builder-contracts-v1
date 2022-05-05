//import chai from 'chai'
//const { expect } = chai
import { ethers } from 'hardhat'
//import { solidity } from 'ethereum-waffle'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Estimator } from '../lib/estimator'
import { getLiveContracts } from '../lib/mainnet'
import { increaseTime } from '../lib/utils'

const { constants, getSigners, getContractFactory } = ethers
const { AddressZero, WeiPerEther } = constants

//chai.use(solidity)

describe('Live Estimates', function () {
	let	accounts: SignerWithAddress[],
		estimator: Estimator,
		router: Contract,
		controller: Contract,
		oracle: Contract,
		eDPI: Contract,
		eYETI: Contract,
		aaveV2AdapterAddress: string,
		compoundAdapterAddress: string,
		curveAdapterAddress: string,
		curveLPAdapterAddress: string,
		curveGaugeAdapterAddress: string,
		kyberSwapAdapterAddress: string,
		metaStrategyAdapterAddress: string,
		sushiSwapAdapterAddress: string,
		synthetixAdapterAddress: string,
		uniswapV2AdapterAddress: string,
		uniswapV3AdapterAddress: string,
		yearnV2AdapterAddress: string

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()

		const enso = getLiveContracts(accounts[0])
		controller = enso.platform.controller
		oracle = enso.platform.oracles.ensoOracle
		router = enso.routers.loop

		const {
			tokenRegistry,
			uniswapV3Registry,
			curveDepositZapRegistry
		} = enso.platform.oracles.registries

		aaveV2AdapterAddress = enso.adapters.aaveV2.address || AddressZero
		compoundAdapterAddress = enso.adapters.compound.address || AddressZero
		curveAdapterAddress = enso.adapters.curve.address || AddressZero
		curveLPAdapterAddress = enso.adapters.curveLP.address || AddressZero
		curveGaugeAdapterAddress = enso.adapters.curveGauge.address || AddressZero
		kyberSwapAdapterAddress = enso.adapters.kyberSwap.address || AddressZero
		metaStrategyAdapterAddress = enso.adapters.metastrategy.address || AddressZero
		sushiSwapAdapterAddress = enso.adapters.sushiSwap.address || AddressZero
		synthetixAdapterAddress = enso.adapters.synthetix.address || AddressZero
		uniswapV2AdapterAddress = enso.adapters.uniswapV2.address || AddressZero
		uniswapV3AdapterAddress = enso.adapters.uniswapV3.address || AddressZero
		yearnV2AdapterAddress = enso.adapters.yearnV2.address || AddressZero

		estimator = new Estimator(
			accounts[0],
			oracle,
			tokenRegistry,
			uniswapV3Registry,
			curveDepositZapRegistry,
			aaveV2AdapterAddress,
			compoundAdapterAddress,
			curveAdapterAddress,
			curveLPAdapterAddress,
			curveGaugeAdapterAddress,
			kyberSwapAdapterAddress,
			metaStrategyAdapterAddress,
			sushiSwapAdapterAddress,
			synthetixAdapterAddress,
			uniswapV2AdapterAddress,
			uniswapV3AdapterAddress,
			yearnV2AdapterAddress
		)

		const Strategy = await getContractFactory('Strategy')
		eDPI = await Strategy.attach('0x890ed1ee6d435a35d51081ded97ff7ce53be5942')
		eYETI = await Strategy.attach('0xA6A6550CbAf8CCd944f3Dd41F2527d441999238c')
	})

	it('Should estimate deposit eDPI', async function() {
		const [ totalBefore, ] = await oracle.estimateStrategy(eDPI.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eDPI, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller.connect(accounts[1]).deposit(eDPI.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [ totalAfter ] = await oracle.estimateStrategy(eDPI.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})

	it('Should estimate deposit eYETI', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle.estimateStrategy(eYETI.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eYETI, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller.connect(accounts[1]).deposit(eYETI.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [ totalAfter ] = await oracle.estimateStrategy(eYETI.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})
})
