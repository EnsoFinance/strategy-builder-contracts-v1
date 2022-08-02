import chai from 'chai'
import hre from 'hardhat'
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
import AaveV2Estimator from '../artifacts/contracts/oracles/estimators/AaveV2Estimator.sol/AaveV2Estimator.json'
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
		strategyClaim: Contract,
		oldAdapters: string[],
		newAdapters: string[]

	async function updateAdapters(strategy: Contract) {
		// Impersonate manager
		const managerAddress = await strategy.manager()
		await network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [managerAddress],
		})
		const manager = await ethers.getSigner(managerAddress)

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

	before('Setup Uniswap + Factory', async function () {
		const _config: any = hre.network.config
		await hre.network.provider.request({
			method: 'hardhat_reset',
			params: [
				{
					forking: {
						jsonRpcUrl: _config.forking.url,
						blockNumber: _config.forking.blockNumber,
					},
				},
			],
		})

		accounts = await getSigners()
		// Impersonate owner
		await network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [ownerAddress],
		})
		const owner = await ethers.getSigner(ownerAddress)

		// Send funds to owner
		await accounts[19].sendTransaction({ to: ownerAddress, value: WeiPerEther.mul(5) })

		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])

		const enso = getLiveContracts(accounts[0])
		controller = enso.platform.controller

		const factory = enso.platform.strategyFactory

		const { tokenRegistry, uniswapV3Registry, chainlinkRegistry, curveDepositZapRegistry } =
			enso.platform.oracles.registries

		// Deploy test UniswapV3RegistryWRapper
		const UniswapV3RegistryWrapper = await getContractFactory('UniswapV3RegistryWrapper')
		const uniswapV3RegistryWrapper = await UniswapV3RegistryWrapper.deploy(uniswapV3Registry.address)
		await uniswapV3RegistryWrapper.deployed()
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
					return factory.connect(owner).addEstimatorToRegistry(estimatorCategory, estimatorAddress)
				}
			)
		)[0]
		await factory.connect(owner).updateOracle(oracle.address)
		await controller.connect(owner).updateAddresses()
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
		uniswapV3 = await deployUniswapV3Adapter(
			owner,
			enso.platform.oracles.registries.uniswapV3Registry,
			uniswapV3Router,
			weth
		)
		await enso.platform.administration.whitelist.connect(owner).approve(uniswapV3.address)
		aaveV2 = await deployAaveV2Adapter(
			accounts[0],
			aaveAddressProvider,
			enso.platform.controller,
			weth,
			enso.platform.oracles.registries.tokenRegistry,
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

		strategyClaim = await waffle.deployContract(accounts[0], StrategyClaim, [])
		await strategyClaim.deployed()

		const Strategy = await getContractFactory('Strategy', {
			libraries: { StrategyClaim: strategyClaim.address },
		})
		eDPI = await Strategy.attach('0x890ed1ee6d435a35d51081ded97ff7ce53be5942')
		eYETI = await Strategy.attach('0xA6A6550CbAf8CCd944f3Dd41F2527d441999238c')
		eYLA = await Strategy.attach('0xb41a7a429c73aa68683da1389051893fe290f614')
		eNFTP = await Strategy.attach('16f7a9c3449f9c67e8c7e8f30ae1ee5d7b8ed10d')
		eETH2X = await Strategy.attach('0x81cddbf4a9d21cf52ef49bda5e5d5c4ae2e40b3e')
		const strategies = [eDPI, eYETI, eYLA, eNFTP, eETH2X]

		const strategyFactory = enso.platform.strategyFactory

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

		const newControllerImplementation = await waffle.deployContract(
			accounts[0],
			linkBytecode(StrategyController, [controllerLibraryLink]),
			[strategyFactory.address]
		)

		await newControllerImplementation.deployed()
		const platformProxyAdmin = enso.platform.administration.platformProxyAdmin
		await platformProxyAdmin
			.connect(await impersonate(await platformProxyAdmin.owner()))
			.upgrade(controller.address, newControllerImplementation.address)

		strategies.forEach(async (s: Contract) => {
			const mgr = await impersonate(await s.manager())
			await strategyAdmin.connect(mgr).upgrade(s.address)
			// ATTN DEPLOYER: this next step is important! Timelocks should be set for all new timelocks!!!
			await s.connect(mgr).updateTimelock(await Strategy.interface.getSighash('updateTradeData'), 5 * 60)
			await s.connect(accounts[3]).finalizeTimelock() // anyone calls

			await s.connect(accounts[3]).updateRewards() // anyone calls
		})

		await updateAdapters(eDPI)
		await updateAdapters(eYETI)
		await updateAdapters(eYLA)
		await updateAdapters(eNFTP)
		await updateAdapters(eETH2X)

		// Deploy new router
		router = await deployFullRouter(
			accounts[0],
			new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], accounts[0]),
			controller,
			enso.platform.strategyLibrary
		)
		// Whitelist
		await enso.platform.administration.whitelist.connect(owner).approve(router.address)

		// Factory Implementation
		const factoryImplementation = await waffle.deployContract(owner, StrategyProxyFactory, [controller.address])
		await factoryImplementation.deployed()
		await platformProxyAdmin
			.connect(await impersonate(await platformProxyAdmin.owner()))
			.upgrade(strategyFactory.address, factoryImplementation.address)

		const newTokenRegistry = await waffle.deployContract(owner, TokenRegistry, [])
		await newTokenRegistry.deployed()

		const aaveV2Estimator = await waffle.deployContract(owner, AaveV2Estimator, [])
		await newTokenRegistry.connect(owner).addEstimator(ESTIMATOR_CATEGORY.AAVE_V2, aaveV2Estimator.address)

		await newTokenRegistry.connect(owner).transferOwnership(strategyFactory.address)

		await strategyFactory
			.connect(await impersonate(await strategyFactory.owner()))
			.updateRegistry(newTokenRegistry.address)

		let tradeData: TradeData = {
			adapters: [],
			path: [],
			cache: '0x',
		}

		await strategyFactory
			.connect(await impersonate(await strategyFactory.owner()))
			.addItemDetailedToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE_V2, tokens.aWETH, tradeData, true)
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
