import { ethers } from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Estimator } from '../lib/estimator'
import { getLiveContracts } from '../lib/mainnet'
import { increaseTime } from '../lib/utils'

const { constants, getSigners, getContractFactory } = ethers
const { WeiPerEther } = constants

describe('Live Estimates', function () {
	let	accounts: SignerWithAddress[],
		estimator: Estimator,
		router: Contract,
		controller: Contract,
		oracle: Contract,
		eDPI: Contract,
		eYETI: Contract,
		eYLA: Contract

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

		const {
			aaveV2,
			compound,
			curve,
			curveLP,
			curveGauge,
			kyberSwap,
			metastrategy,
			sushiSwap,
			synthetix,
			uniswapV2,
			uniswapV3,
			yearnV2
		} = enso.adapters

		estimator = new Estimator(
			accounts[0],
			oracle,
			tokenRegistry,
			uniswapV3Registry,
			curveDepositZapRegistry,
			aaveV2.address,
			compound.address,
			curve.address,
			curveLP.address,
			curveGauge.address,
			kyberSwap.address,
			metastrategy.address,
			sushiSwap.address,
			synthetix.address,
			uniswapV2.address,
			uniswapV3.address,
			yearnV2.address
		)

		const Strategy = await getContractFactory('Strategy')
		eDPI = await Strategy.attach('0x890ed1ee6d435a35d51081ded97ff7ce53be5942')
		eYETI = await Strategy.attach('0xA6A6550CbAf8CCd944f3Dd41F2527d441999238c')
		eYLA = await Strategy.attach('0xb41a7a429c73aa68683da1389051893fe290f614')
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

	it('Should estimate deposit eYLA', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle.estimateStrategy(eYLA.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eYLA, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller.connect(accounts[1]).deposit(eYLA.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [ totalAfter ] = await oracle.estimateStrategy(eYLA.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})
})
