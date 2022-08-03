import chai from 'chai'
const { expect } = chai
import { ethers, network, waffle } from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Estimator } from '../lib/estimator'
import { Tokens } from '../lib/tokens'
import { getLiveContracts } from '../lib/mainnet'
import { increaseTime } from '../lib/utils'
import {
	deployOracle,
	deployFullRouter,
	deployUniswapV3Adapter,
	deployAaveV2Adapter,
	deployAaveV2DebtAdapter,
} from '../lib/deploy'
import { TradeData } from '../lib/encode'
import { createLink, linkBytecode } from '../lib/link'
import { DIVISOR, MAINNET_ADDRESSES, ITEM_CATEGORY, ESTIMATOR_CATEGORY } from '../lib/constants'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'

import StrategyClaim from '../artifacts/contracts/libraries/StrategyClaim.sol/StrategyClaim.json'
import ControllerLibrary from '../artifacts/contracts/libraries/ControllerLibrary.sol/ControllerLibrary.json'
import StrategyLibrary from '../artifacts/contracts/libraries/StrategyLibrary.sol/StrategyLibrary.json'
import StrategyController from '../artifacts/contracts/StrategyController.sol/StrategyController.json'
import StrategyProxyFactory from '../artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json'
import TokenRegistry from '../artifacts/contracts/oracles/registries/TokenRegistry.sol/TokenRegistry.json'
const { constants, getSigners, getContractFactory } = ethers
const { WeiPerEther } = constants

const ownerAddress = '0xca702d224D61ae6980c8c7d4D98042E22b40FFdB'

async function impersonate(address: string): Promise<SignerWithAddress> {
	await network.provider.request({
		method: 'hardhat_impersonateAccount',
		params: [address],
	})
	return await ethers.getSigner(address)
}

describe('Live Estimates', function () {
	let accounts: SignerWithAddress[],
		owner: SignerWithAddress,
		estimator: Estimator,
		tokens: Tokens,
		weth: Contract,
		router: Contract,
		controller: Contract,
		oracle: Contract,
		eDPI: Contract,
		eYETI: Contract,
		eYLA: Contract,
		eNFTP: Contract,
		eETH2X: Contract,
		oldAdapters: string[],
		newAdapters: string[]

	async function updateAdapters(strategy: Contract) {
		// Impersonate manager
		const managerAddress = await strategy.manager()
		const manager = await impersonate(managerAddress)

		// Send funds to manager
		await accounts[19].sendTransaction({ to: managerAddress, value: WeiPerEther })

		const items = await strategy.items()
		for (let i = 0; i < items.length; i++) {
			let tradeData = await strategy.getTradeData(items[i])
			let adapters = [...tradeData.adapters]
			let shouldUpdate = false
			for (let j = 0; j < adapters.length; j++) {
				for (let k = 0; k < oldAdapters.length; k++) {
					if (adapters[j].toLowerCase() == oldAdapters[k].toLowerCase()) {
						adapters[j] = newAdapters[k]
						shouldUpdate = true
					}
				}
			}
			if (shouldUpdate) {
				await strategy.connect(manager).updateTradeData(items[i], {
					...tradeData,
					adapters: adapters,
				})
				await increaseTime(5 * 60)
				await strategy.connect(manager).finalizeTradeData()
			}
		}
	}

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

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		// Impersonate owner
		owner = await impersonate(ownerAddress)

		// Send funds to owner
		await accounts[19].sendTransaction({ to: ownerAddress, value: WeiPerEther.mul(5) })

		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])

		const enso = getLiveContracts(accounts[0])

		controller = enso.platform.controller
		const strategyFactory = enso.platform.strategyFactory
		const { uniswapV3Registry, chainlinkRegistry, curveDepositZapRegistry } = enso.platform.oracles.registries

		// Deploy test UniswapV3RegistryWrapper
		const UniswapV3RegistryWrapper = await getContractFactory('UniswapV3RegistryWrapper')
		const uniswapV3RegistryWrapper = await UniswapV3RegistryWrapper.deploy(uniswapV3Registry.address)
		await uniswapV3RegistryWrapper.deployed()
		await uniswapV3Registry.connect(owner).transferOwnership(uniswapV3RegistryWrapper.address)

		// Deploy new token registry
		const tokenRegistry = await waffle.deployContract(owner, TokenRegistry, [])
		await tokenRegistry.deployed()

		// Deploy new oracle
		const uniswapV3Factory: Contract = new Contract(MAINNET_ADDRESSES.UNISWAP_V3_FACTORY, [], accounts[0])
		oracle = (
			await deployOracle(
				owner,
				uniswapV3Factory,
				uniswapV3Factory,
				tokenRegistry,
				uniswapV3RegistryWrapper,
				chainlinkRegistry,
				weth,
				new Contract(tokens.sUSD, ERC20.abi, accounts[0]),
				(estimatorCategory: number, estimatorAddress: string) => {
					return tokenRegistry.connect(owner).addEstimator(estimatorCategory, estimatorAddress)
				}
			)
		)[0]

		// Transfer token registry
		await tokenRegistry.connect(owner).transferOwnership(strategyFactory.address)

		// Deploy new router
		router = await deployFullRouter(
			accounts[0],
			new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], accounts[0]),
			controller,
			enso.platform.strategyLibrary
		)
		// Whitelist
		await enso.platform.administration.whitelist.connect(owner).approve(router.address)

		let {
			aaveV2,
			aaveV2Debt,
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
			yearnV2,
		} = enso.adapters

		// Store old adapter addresses
		oldAdapters = [uniswapV3.address, aaveV2.address, aaveV2Debt.address]
		// Deploy and whitelist new adapters
		const uniswapV3Router = new Contract(MAINNET_ADDRESSES.UNISWAP_V3_ROUTER, [], owner)
		const aaveAddressProvider = new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], owner)
		uniswapV3 = await deployUniswapV3Adapter(owner, uniswapV3RegistryWrapper, uniswapV3Router, weth)
		await enso.platform.administration.whitelist.connect(owner).approve(uniswapV3.address)
		aaveV2 = await deployAaveV2Adapter(
			accounts[0],
			aaveAddressProvider,
			controller,
			weth,
			tokenRegistry,
			ESTIMATOR_CATEGORY.AAVE_V2
		)
		await enso.platform.administration.whitelist.connect(owner).approve(aaveV2.address)
		aaveV2Debt = await deployAaveV2DebtAdapter(owner, aaveAddressProvider, weth)
		await enso.platform.administration.whitelist.connect(owner).approve(aaveV2Debt.address)
		// Store new adapter addresses
		newAdapters = [uniswapV3.address, aaveV2.address, aaveV2Debt.address]

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

		const strategyClaim = await waffle.deployContract(accounts[0], StrategyClaim, [])
		await strategyClaim.deployed()

		const Strategy = await getContractFactory('Strategy', {
			libraries: { StrategyClaim: strategyClaim.address },
		})
		console.log('strategy size:', Strategy.bytecode.length / 2 - 1)
		eDPI = await Strategy.attach('0x890ed1ee6d435a35d51081ded97ff7ce53be5942')
		eYETI = await Strategy.attach('0xA6A6550CbAf8CCd944f3Dd41F2527d441999238c')
		eYLA = await Strategy.attach('0xb41a7a429c73aa68683da1389051893fe290f614')
		eNFTP = await Strategy.attach('16f7a9c3449f9c67e8c7e8f30ae1ee5d7b8ed10d')
		eETH2X = await Strategy.attach('0x81cddbf4a9d21cf52ef49bda5e5d5c4ae2e40b3e')
		const strategies = [eDPI, eYETI, eYLA, eNFTP, eETH2X]

		// update to latest `Strategy`
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

		// Update factory/controller addresses
		await strategyFactory.connect(owner).updateRegistry(tokenRegistry.address)
		await strategyFactory.connect(owner).updateOracle(oracle.address)
		await controller.connect(owner).updateAddresses()

		// Update token registry
		await tokens.registerTokens(owner, strategyFactory, uniswapV3RegistryWrapper)
		let tradeData: TradeData = {
			adapters: [aaveV2.address],
			path: [],
			cache: '0x',
		}
		await strategyFactory
			.connect(owner)
			.addItemDetailedToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE_V2, tokens.aWETH, tradeData, true)

		const stkAAVE = new Contract('0x4da27a545c0c5B758a6BA100e3a049001de870f5', ERC20.abi, accounts[0])
		tradeData.adapters[0] = uniswapV2.address
		await strategyFactory
			.connect(owner)
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.DEFAULT_ORACLE,
				stkAAVE.address,
				tradeData,
				false
			)
		for (let i = 0; i < strategies.length; i++) {
			const s = strategies[i]
			const mgr = await impersonate(await s.manager())
			await strategyAdmin.connect(mgr).upgrade(s.address)
			// ATTN DEPLOYER: this next step is important! Timelocks should be set for all new timelocks!!!
			await s.connect(mgr).updateTimelock(await Strategy.interface.getSighash('updateTradeData'), 5 * 60)
			await s.connect(accounts[3]).finalizeTimelock() // anyone calls
			await updateAdapters(s)
			await s.connect(accounts[3]).updateRewards() // anyone calls
			// Update token registry using old token registry
			await updateTokenRegistry(
				strategyFactory,
				enso.platform.oracles.registries.tokenRegistry,
				s,
				await s.items()
			)
			await updateTokenRegistry(
				strategyFactory,
				enso.platform.oracles.registries.tokenRegistry,
				s,
				await s.debt()
			)
		}
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

	it('Should estimate deposit eETH2X', async function () {
		const [totalBefore] = await oracle.estimateStrategy(eETH2X.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eETH2X, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller
			.connect(accounts[1])
			.deposit(eETH2X.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [totalAfter] = await oracle.estimateStrategy(eETH2X.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})

	it('Should estimate withdraw eETH2X', async function () {
		await increaseTime(1)
		const [totalBefore] = await oracle.estimateStrategy(eETH2X.address)
		const withdrawAmount = await eETH2X.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await eETH2X.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eETH2X, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
		let tx = await controller
			.connect(accounts[1])
			.withdrawWETH(eETH2X.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
	})

	it('Should estimate deposit eDPI', async function () {
		const [totalBefore] = await oracle.estimateStrategy(eDPI.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eDPI, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller
			.connect(accounts[1])
			.deposit(eDPI.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [totalAfter] = await oracle.estimateStrategy(eDPI.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})

	it('Should estimate withdraw eDPI', async function () {
		await increaseTime(1)
		const [totalBefore] = await oracle.estimateStrategy(eDPI.address)
		const withdrawAmount = await eDPI.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await eDPI.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eDPI, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
		let tx = await controller
			.connect(accounts[1])
			.withdrawWETH(eDPI.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
	})

	it('Should estimate deposit eYETI', async function () {
		await increaseTime(1)
		const [totalBefore] = await oracle.estimateStrategy(eYETI.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eYETI, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller
			.connect(accounts[1])
			.deposit(eYETI.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [totalAfter] = await oracle.estimateStrategy(eYETI.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})

	it('Should estimate withdraw eYETI', async function () {
		await increaseTime(1)
		const [totalBefore] = await oracle.estimateStrategy(eYETI.address)
		const withdrawAmount = await eYETI.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await eYETI.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eYETI, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
		let tx = await controller
			.connect(accounts[1])
			.withdrawWETH(eYETI.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
	})

	it('Should estimate deposit eYLA', async function () {
		await increaseTime(1)
		const [totalBefore] = await oracle.estimateStrategy(eYLA.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eYLA, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller
			.connect(accounts[1])
			.deposit(eYLA.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [totalAfter] = await oracle.estimateStrategy(eYLA.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})

	it('Should estimate withdraw eYLA', async function () {
		await increaseTime(1)
		const [totalBefore] = await oracle.estimateStrategy(eYLA.address)
		const withdrawAmount = await eYLA.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await eYLA.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eYLA, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
		let tx = await controller
			.connect(accounts[1])
			.withdrawWETH(eYLA.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
	})

	it('Should estimate deposit eNFTP', async function () {
		await increaseTime(1)
		const [totalBefore] = await oracle.estimateStrategy(eNFTP.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eNFTP, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller
			.connect(accounts[1])
			.deposit(eNFTP.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [totalAfter] = await oracle.estimateStrategy(eNFTP.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})

	it('Should estimate withdraw eNFTP', async function () {
		await increaseTime(1)
		const [totalBefore] = await oracle.estimateStrategy(eNFTP.address)
		const withdrawAmount = await eNFTP.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await eNFTP.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eNFTP, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
		let tx = await controller
			.connect(accounts[1])
			.withdrawWETH(eNFTP.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
	})
})
