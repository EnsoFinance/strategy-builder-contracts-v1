import chai from 'chai'
const { expect } = chai
import { ethers, network, waffle } from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { getLiveContracts } from '../lib/mainnet'
import { increaseTime } from '../lib/utils'
import { isRevertedWith } from '../lib/errors'

import StrategyClaim from '../artifacts/contracts/libraries/StrategyClaim.sol/StrategyClaim.json'
import StrategyToken from '../artifacts/contracts/StrategyToken.sol/StrategyToken.json'

const { constants, getSigners, getContractFactory } = ethers
const { AddressZero } = constants

import ClonableTransparentUpgradeableProxy from '../artifacts/contracts/helpers/ClonableTransparentUpgradeableProxy.sol/ClonableTransparentUpgradeableProxy.json'

async function impersonate(address: string): Promise<SignerWithAddress> {
	await network.provider.request({
		method: 'hardhat_impersonateAccount',
		params: [address],
	})
	return await ethers.getSigner(address)
}

describe('Live Upgrades', function () {
	let accounts: SignerWithAddress[],
		controller: Contract,
		strategyFactory: Contract,
		strategyClaim: Contract,
		eDPI: Contract

	before('Setup contracts', async function () {
		accounts = await getSigners()

		const enso = getLiveContracts(accounts[0])
		controller = enso.platform.controller
		strategyFactory = enso.platform.strategyFactory

		strategyClaim = await waffle.deployContract(accounts[0], StrategyClaim, [])
		await strategyClaim.deployed()

		const Strategy = await getContractFactory('Strategy', {
			libraries: { StrategyClaim: strategyClaim.address },
		})
		// example live strategy
		eDPI = await Strategy.attach('0x890ed1ee6d435a35d51081ded97ff7ce53be5942')

		// update to latest `Strategy`
		const strategyToken = await waffle.deployContract(accounts[0], StrategyToken, [
			strategyFactory.address,
			controller.address,
		])
		const clonableTransparentUpgradeableProxy = await waffle.deployContract(
			accounts[0],
			ClonableTransparentUpgradeableProxy,
			[strategyToken.address, AddressZero]
		) // second parameter would be manager but is reset when cloned
		await clonableTransparentUpgradeableProxy.deployed()

		const newImplementation = await Strategy.deploy(
			clonableTransparentUpgradeableProxy.address,
			strategyFactory.address,
			controller.address,
			AddressZero,
			AddressZero
		)

		const version = await strategyFactory.callStatic.version()

		await strategyFactory
			.connect(await impersonate(await strategyFactory.owner()))
			.updateImplementation(newImplementation.address, (version + 1).toString())

		let admin = await strategyFactory.admin()
		const StrategyAdmin = await getContractFactory('StrategyProxyAdmin')
		let strategyAdmin = await StrategyAdmin.attach(admin)
		await strategyAdmin.connect(await impersonate(await eDPI.manager())).upgrade(eDPI.address)
	})

	it('Should be initialized.', async function () {
		/*
		 * if the latest `Strategy` implementation incorrectly updates storage
		 * then the deployed instance would incorrectly (and dangerously)
		 * not be deemed initialized.
		 */

		// now call initialize
		const someMaliciousAddress = accounts[8].address
		await expect(
			eDPI.initialize('anyName', 'anySymbol', 'anyVersion', someMaliciousAddress, [])
		).to.be.revertedWith('Initializable: contract is already initialized')
	})

	it('Should updateTradeData respecting timelock', async function () {
		// first manager must setup the timelock
		let updateTradeDataSelector = eDPI.interface.getSighash('updateTradeData')
		await eDPI.connect(await impersonate(await eDPI.manager())).updateTimelock(updateTradeDataSelector, 5 * 60)
		await eDPI.connect(accounts[1]).finalizeTimelock()

		// now updateTradeData respecting the timelock
		const items = await eDPI.items()
		const tradeData = await eDPI.getTradeData(items[0])
		expect(tradeData.adapters[0]).to.not.deep.equal(items[0])

		await eDPI.connect(await impersonate(await eDPI.manager())).updateTradeData(items[0], {
			adapters: [AddressZero], // to test
			path: [],
			cache: '0x',
		})
		// sanity check
		expect(
			await isRevertedWith(
				eDPI.connect(accounts[1]).finalizeUpdateTradeData(),
				'finalizeUpdateTradeData: timelock not ready.',
				'Strategy.sol'
			)
		).to.be.true
		await increaseTime(5 * 60)
		await eDPI.connect(accounts[1]).finalizeUpdateTradeData()

		const tradeDataAfter = await eDPI.getTradeData(items[0])
		expect(tradeDataAfter.adapters[0]).to.deep.equal(AddressZero)
	})
})
