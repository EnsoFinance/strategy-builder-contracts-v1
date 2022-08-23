import { ethers, waffle } from 'hardhat'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Tokens } from '../lib/tokens'
import { getLiveContracts } from '../lib/mainnet'
import { createLink, linkBytecode } from '../lib/link'
import { MAINNET_ADDRESSES, ITEM_CATEGORY, ESTIMATOR_CATEGORY, VIRTUAL_ITEM } from '../lib/constants'
import { prepareStrategy } from '../lib/encode'
import { resetBlockchain, impersonate } from '../lib/utils'
import { initializeTestLogging, logTestComplete } from '../lib/convincer'

import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import StrategyClaim from '../artifacts/contracts/libraries/StrategyClaim.sol/StrategyClaim.json'
import ControllerLibrary from '../artifacts/contracts/libraries/ControllerLibrary.sol/ControllerLibrary.json'
import StrategyLibrary from '../artifacts/contracts/libraries/StrategyLibrary.sol/StrategyLibrary.json'
import StrategyController from '../artifacts/contracts/StrategyController.sol/StrategyController.json'
import StrategyProxyFactory from '../artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json'

// ATTN dev: Tests contracts deployed to mainnet. Integration testing updates to contracts require a redeployment of updated contract within this test.

const { constants, getSigners, getContractFactory } = ethers
const { AddressZero, WeiPerEther } = constants

const ownerAddress = '0xca702d224D61ae6980c8c7d4D98042E22b40FFdB'

const synthRedeemer = '0xe533139Af961c9747356D947838c98451015e234'

describe('Remove sDEFI from live contracts', function () {
	let proofCounter: number,
		accounts: SignerWithAddress[],
		owner: SignerWithAddress,
		manager: SignerWithAddress,
		tokens: Tokens,
		weth: Contract,
		whitelist: Contract,
		router: Contract,
		controller: Contract,
		oracle: Contract,
		eDTOP: Contract

	async function updateTokenRegistry(
		strategyFactory: Contract,
		oldTokenRegistry: Contract,
		strategy: Contract,
		tokens: string[]
	) {
		let itemCategory, estimatorCategory
		for (let i = 0; i < tokens.length; i++) {
			// Set token
			estimatorCategory = await oldTokenRegistry.estimatorCategories(tokens[i])
			if (estimatorCategory.gt(0)) {
				itemCategory = await oldTokenRegistry.itemCategories(tokens[i])
				await strategyFactory.connect(owner).addItemToRegistry(itemCategory, estimatorCategory, tokens[i])
			}
			// Set path
			const tradeData = await strategy.getTradeData(tokens[i])
			let path = [...tradeData.path]
			for (let j = 0; j < path.length; j++) {
				estimatorCategory = await oldTokenRegistry.estimatorCategories(path[j])
				if (estimatorCategory.gt(0)) {
					itemCategory = await oldTokenRegistry.itemCategories(path[j])
					await strategyFactory.connect(owner).addItemToRegistry(itemCategory, estimatorCategory, path[j])
				}
			}
		}
	}

	before('Setup contracts', async function () {
		proofCounter = initializeTestLogging(this, __dirname)

		await resetBlockchain()

		accounts = await getSigners()
		// Impersonate owner
		owner = await impersonate(ownerAddress)

		// Send funds to owner
		await accounts[19].sendTransaction({ to: ownerAddress, value: WeiPerEther.mul(5) })

		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])

		const enso = getLiveContracts(accounts[0])
		controller = enso.platform.controller
		router = enso.routers.multicall
		whitelist = enso.platform.administration.whitelist
		await whitelist.connect(owner).approve(router.address)
		const strategyFactory = enso.platform.strategyFactory
		const { tokenRegistry, uniswapV3Registry, chainlinkRegistry } = enso.platform.oracles.registries

		// Transfer token registry
		await tokenRegistry
			.connect(await impersonate(await tokenRegistry.owner()))
			.transferOwnership(strategyFactory.address)

		if ((await chainlinkRegistry.owner()).toLowerCase() !== owner.address.toLowerCase)
			await chainlinkRegistry
				.connect(await impersonate(await chainlinkRegistry.owner()))
				.transferOwnership(owner.address)

		if ((await uniswapV3Registry.owner()).toLowerCase() !== owner.address.toLowerCase)
			await uniswapV3Registry
				.connect(await impersonate(await uniswapV3Registry.owner()))
				.transferOwnership(owner.address)

		oracle = enso.platform.oracles.ensoOracle

		// Deploy SynthRedeemerAdapter
		const SynthRedeemerAdapter = await getContractFactory('SynthRedeemerAdapter')
		const synthRedeemerAdapter = await SynthRedeemerAdapter.deploy(synthRedeemer, tokens.sUSD, weth.address)
		await synthRedeemerAdapter.deployed()

		// Whitelist
		await enso.platform.administration.whitelist.connect(owner).approve(synthRedeemerAdapter.address)

		// Libraries
		const strategyLibrary = await waffle.deployContract(accounts[0], StrategyLibrary, [])
		await strategyLibrary.deployed()
		const strategyLibraryLink = createLink(StrategyLibrary, strategyLibrary.address)

		const controllerLibrary = await waffle.deployContract(
			accounts[0],
			linkBytecode(ControllerLibrary, [strategyLibraryLink]),
			[]
		)
		await controllerLibrary.deployed()
		const controllerLibraryLink = createLink(ControllerLibrary, controllerLibrary.address)

		// Controller Implementation
		const newControllerImplementation = await waffle.deployContract(
			accounts[0],
			linkBytecode(StrategyController, [controllerLibraryLink]),
			[strategyFactory.address]
		)

		await newControllerImplementation.deployed()
		const platformProxyAdmin = enso.platform.administration.platformProxyAdmin
		await platformProxyAdmin.connect(owner).upgrade(controller.address, newControllerImplementation.address)

		// Factory Implementation
		const factoryImplementation = await waffle.deployContract(owner, StrategyProxyFactory, [controller.address])
		await factoryImplementation.deployed()
		await platformProxyAdmin.connect(owner).upgrade(strategyFactory.address, factoryImplementation.address)

		// Update to latest Strategy
		const strategyClaim = await waffle.deployContract(accounts[0], StrategyClaim, [])
		await strategyClaim.deployed()

		const Strategy = await getContractFactory('Strategy', {
			libraries: { StrategyClaim: strategyClaim.address },
		})

		const newImplementation = await Strategy.deploy(
			strategyFactory.address,
			controller.address,
			MAINNET_ADDRESSES.SYNTHETIX_ADDRESS_PROVIDER,
			MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER
		)

		const version = await strategyFactory.callStatic.version()
		await strategyFactory.connect(owner).updateImplementation(newImplementation.address, (version + 1).toString())

		const admin = await strategyFactory.admin()
		const StrategyAdmin = await getContractFactory('StrategyProxyAdmin')
		const strategyAdmin = await StrategyAdmin.attach(admin)

		// Update factory/controller addresses (NOTE: must update oracle before registry)
		await strategyFactory.connect(owner).updateOracle(oracle.address)
		await strategyFactory.connect(owner).updateRegistry(tokenRegistry.address)
		await controller.connect(owner).updateAddresses()

		// Set synthetix adapters
		await strategyFactory
			.connect(owner)
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.RESERVE,
				ESTIMATOR_CATEGORY.BLOCKED,
				VIRTUAL_ITEM,
				{ adapters: [enso.adapters.synthetix.address, synthRedeemerAdapter.address], path: [], cache: '0x' },
				AddressZero
			)

		// Upgrade strategy
		eDTOP = await Strategy.attach('0x0CF65Dcf23c3a67D1A220A2732B5c2F7921A30c4')
		manager = await impersonate(await eDTOP.manager())
		await strategyAdmin.connect(manager).upgrade(eDTOP.address)

		await updateTokenRegistry(strategyFactory, enso.platform.oracles.registries.tokenRegistry, eDTOP, [
			tokens.sUSD,
			...(await eDTOP.synths()),
		])
	})

	/*
	it('Should update Chainlink registry', async function () { // convincer-ignore
			await expect(oracle.estimateStrategy(eDTOP.address)).to.be.revertedWith('');
			await chainlinkRegistry.connect(owner).addOracle(tokens.sDEFI, tokens.sUSD, sDEFIAggregator, false);
			const [ total, ] = await oracle.estimateStrategy(eDTOP.address)
			console.log("eDTOP Total: ", total.toString())
	})
	*/

	it('Should reposition', async function () {
		let tx = await controller.connect(manager).repositionSynths(eDTOP.address, tokens.sDEFI)
		const receipt = await tx.wait()
		console.log('Redeem Gas Used: ', receipt.gasUsed.toString())
		expect((await oracle['estimateItem(address,address)'](eDTOP.address, tokens.sDEFI)).eq(0)).to.equal(true)

		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should restructure', async function () {
		const synths = await eDTOP.synths()
		const positions = []
		let totalPercentage = BigNumber.from(0)
		for (let i = 0; i < synths.length; i++) {
			if (synths[i] != tokens.sDEFI) {
				const percentage = await eDTOP.getPercentage(synths[i])
				const tradeData = await eDTOP.getTradeData(synths[i]) // NOTE: We should use updated adapters for the real restructure
				positions.push({
					token: synths[i],
					percentage: percentage,
					adapters: tradeData.adapters,
					path: tradeData.path,
					cache: tradeData.cache,
				})
				totalPercentage = totalPercentage.add(percentage)
			}
		}
		const percentage = BigNumber.from(1000).sub(totalPercentage)
		const tradeData = await eDTOP.getTradeData(tokens.sUSD)
		positions.push({
			token: tokens.sUSD,
			percentage: percentage,
			adapters: tradeData.adapters,
			path: tradeData.path,
			cache: tradeData.cache,
		})
		const strategyItems = prepareStrategy(positions, AddressZero)
		await controller.connect(manager).restructure(eDTOP.address, strategyItems)

		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should finalize structure', async function () {
		const data = await router.encodeCalls([]) // No calls
		await controller.connect(manager).finalizeStructure(eDTOP.address, router.address, data)

		logTestComplete(this, __dirname, proofCounter++)
	})
})
