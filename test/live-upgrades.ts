import chai from 'chai'
const { expect } = chai
import { ethers } from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { getLiveContracts } from '../lib/mainnet'
import { increaseTime, resetBlockchain, impersonate } from '../lib/utils'
import { initializeTestLogging, logTestComplete } from '../lib/convincer'
import { isRevertedWith } from '../lib/errors'
import { TIMELOCK_CATEGORY } from '../lib/constants'

const { constants, getSigners, getContractFactory } = ethers
const { MaxUint256, /*WeiPerEther,*/ AddressZero } = constants

const ownerAddress = '0xca702d224D61ae6980c8c7d4D98042E22b40FFdB'

describe('Live Upgrades', function () {
	let proofCounter: number
	let accounts: SignerWithAddress[],
		owner: SignerWithAddress,
		manager: SignerWithAddress,
		controller: Contract,
		strategyFactory: Contract,
		strategyClaim: Contract,
		eDPI: Contract

	before('Setup contracts', async function () {
		proofCounter = initializeTestLogging(this, __dirname)

		await resetBlockchain()

		accounts = await getSigners()

		// Impersonate owner
		owner = await impersonate(ownerAddress)

		const enso = getLiveContracts(accounts[0])
		controller = enso.platform.controller
		strategyFactory = enso.platform.strategyFactory

		// Libraries
		const StrategyClaim = await getContractFactory('StrategyClaim')
		strategyClaim = await StrategyClaim.deploy()
		await strategyClaim.deployed()

		const StrategyLibrary = await getContractFactory('StrategyLibrary')
		const strategyLibrary = await StrategyLibrary.deploy()
		await strategyLibrary.deployed()

		const ControllerLibrary = await getContractFactory('ControllerLibrary', {
			libraries: { StrategyLibrary: strategyLibrary.address }
		})
		const controllerLibrary = await ControllerLibrary.deploy()
		await controllerLibrary.deployed()

		// Controller Implementation
		const ControllerImplementation = await getContractFactory('StrategyController', {
			libraries: { ControllerLibrary: controllerLibrary.address }
		})
		const newControllerImplementation = await ControllerImplementation.deploy(strategyFactory.address)
		await newControllerImplementation.deployed()

		const platformProxyAdmin = enso.platform.administration.platformProxyAdmin
		await platformProxyAdmin.connect(owner).upgrade(controller.address, newControllerImplementation.address)

		// Strategy implementation
		const Strategy = await getContractFactory('Strategy', {
			libraries: { StrategyClaim: strategyClaim.address },
		})

		const newImplementation = await Strategy.deploy(
			strategyFactory.address,
			controller.address,
			AddressZero,
			AddressZero
		)

		await strategyFactory
			.connect(owner)
			.updateImplementation(newImplementation.address, MaxUint256.toString())

		// Example live strategy
		eDPI = await Strategy.attach('0x890ed1ee6d435a35d51081ded97ff7ce53be5942')
		manager = await impersonate(await eDPI.manager())

		let admin = await strategyFactory.admin()
		const StrategyAdmin = await getContractFactory('StrategyProxyAdmin')
		let strategyAdmin = await StrategyAdmin.attach(admin)
		await strategyAdmin.connect(manager).upgrade(eDPI.address)
	})

	it('Should updateTradeData', async function () {
		await controller.connect(manager).updateValue(eDPI.address, TIMELOCK_CATEGORY.TIMELOCK, 5 * 60)
		await controller.connect(manager).finalizeValue(eDPI.address)

		// now updateTradeData respecting the timelock
		const items = await eDPI.items()
		const tradeData = await eDPI.getTradeData(items[0])
		expect(tradeData.adapters[0]).to.not.deep.equal(items[0])

		await controller.connect(manager).updateTradeData(eDPI.address, items[0], {
			adapters: [AddressZero], // to test
			path: [],
			cache: '0x',
		})
		// sanity check
		expect(
			await isRevertedWith(
				controller.connect(accounts[1]).finalizeTradeData(eDPI.address),
				'Timelock active',
				'StrategyController.sol'
			)
		).to.be.true
		await increaseTime(5 * 60)
		await controller.connect(accounts[1]).finalizeTradeData(eDPI.address)

		const tradeDataAfter = await eDPI.getTradeData(items[0])
		expect(tradeDataAfter.adapters[0]).to.deep.equal(AddressZero)
		logTestComplete(this, __dirname, proofCounter++)
	})
})
