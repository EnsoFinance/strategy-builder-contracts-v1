import { MAINNET_ADDRESSES } from '../lib/constants'

const hre = require('hardhat')
const { ethers } = hre
const { getSigners } = ethers
const { EnsoBuilder, EnsoEnvironment, getLiveContracts } = require('../lib/index')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'

describe('SDK', function () {
	let accounts: SignerWithAddress[]
	let mainnetForkEnso: typeof EnsoEnvironment
	let localTestnetEnso: typeof EnsoEnvironment
	before('minimal mainnet-fork setup', async function () {
		accounts = await getSigners()
	})

	it('deploy platform with defaults', async () => {
		mainnetForkEnso = await new EnsoBuilder(accounts[1]).build()
		expect(mainnetForkEnso.uniswapV2Factory.address.toLowerCase()).to.eq(
			MAINNET_ADDRESSES.UNISWAP_V2_FACTORY.toLowerCase()
		)
	})

	it('deploy platform with testnet defaults', async () => {
		localTestnetEnso = await new EnsoBuilder(accounts[1]).testnet().build()
		expect(localTestnetEnso.uniswapV2Factory.address.toLowerCase()).to.not.eq(
			MAINNET_ADDRESSES.UNISWAP_V2_FACTORY.toLowerCase()
		)
	})

	it('deploy platform with leverage adapter', async () => {
		const builder = new EnsoBuilder(accounts[1])
		builder.addAdapter('leverage')
		mainnetForkEnso = await builder.build()
		expect(mainnetForkEnso.adapters.aaveV2.contract).to.not.eq(undefined)
		expect(mainnetForkEnso.adapters.aaveV2Debt.contract).to.not.eq(undefined)
		expect(mainnetForkEnso.adapters.leverage.contract).to.not.eq(undefined)
	})

	it('initialize live platform', async () => {
		const enso = await getLiveContracts(accounts[0])
		expect(enso.adapters.aaveV2).to.not.eq(undefined, 'aaveV2 adapter not found')
		expect(enso.adapters.aaveV2Debt).to.not.eq(undefined)
		expect(enso.adapters.leverage).to.not.eq(undefined)
	})
	/* 
    // TODO: verify these estimators have been set
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.DEFAULT_ORACLE, defaultEstimator.address)
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, chainlinkEstimator.address)
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.STRATEGY, strategyEstimator.address)
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.BLOCKED, emergencyEstimator.address)
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.AAVE_V2, aaveV2Estimator.address)
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.AAVE_V2_DEBT, aaveV2DebtEstimator.address)
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.COMPOUND, compoundEstimator.address)
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.CURVE_LP, curveLPEstimator.address)
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.CURVE_GAUGE, curveGaugeEstimator.address)
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.UNISWAP_V2_LP, uniswapV2LPEstimator.address)
	await tokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.YEARN_V2, yearnV2Estimator.address)
    await tokenRegistry.connect(owner).addItem(ITEM_CATEGORY.RESERVE, ESTIMATOR_CATEGORY.DEFAULT_ORACLE, weth.address)
	if (susd) await tokenRegistry.connect(owner).addItem(ITEM_CATEGORY.RESERVE, ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, susd.address)
    */
})
