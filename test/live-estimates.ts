const hre = require('hardhat')
import { ethers, network } from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Estimator } from '../lib/estimator'
import { MAINNET_ADDRESSES } from '../lib/constants'
import { getLiveContracts } from '../lib/mainnet'
import { increaseTime } from '../lib/utils'

const { constants, getSigners, getContractFactory } = ethers
const { WeiPerEther } = constants

async function impersonate(address: string) : Promise<SignerWithAddress> {
    await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [address],
    })
    return await ethers.getSigner(address)
}

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

    // update the controller
		const StrategyLibrary = await getContractFactory('StrategyLibrary')
		const library = await StrategyLibrary.connect(accounts[0]).deploy()
		await library.deployed()
		const StrategyController = await getContractFactory('StrategyController', {
			libraries: {
				StrategyLibrary: library.address
			}
		})
		const controllerImplementation = await StrategyController.connect(accounts[0]).deploy(enso.platform.strategyFactory.address)
		await controllerImplementation.deployed()
		let controllerProxyAddress = await enso.platform.administration.platformProxyAdmin.controller()
		await enso.platform.administration.platformProxyAdmin.connect(await impersonate(await enso.platform.administration.platformProxyAdmin.owner())).upgrade(controllerProxyAddress, controllerImplementation.address)

		oracle = enso.platform.oracles.ensoOracle
		router = enso.routers.loop

    const EnsoOracle = await getContractFactory("EnsoOracle")
    const ensoOracle = await EnsoOracle.deploy(enso.platform.oracles.registries.tokenRegistry.address, await oracle.weth(), await oracle.susd())
    await ensoOracle.deployed()

    const factoryOwnerAddress = await enso.platform.strategyFactory.owner()
    await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [factoryOwnerAddress],
    })
    const factoryOwner = await ethers.getSigner(factoryOwnerAddress)

    await enso.platform.strategyFactory.connect(factoryOwner).updateOracle(ensoOracle.address)
    await controller.connect(factoryOwner).updateAddresses()
    oracle = ensoOracle

		const Strategy = await getContractFactory('Strategy')
    const newStrategyImplementation = await Strategy.deploy(
      enso.platform.strategyFactory.address,
      controller.address,
      MAINNET_ADDRESSES.SYNTHETIX_ADDRESS_PROVIDER,
      MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER
    )
    await newStrategyImplementation.deployed()
		await	enso.platform.strategyFactory.connect(factoryOwner).updateImplementation(newStrategyImplementation.address, '3')

    // TODO strategy owner needs to update it

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

		eDPI = await Strategy.attach('0x890ed1ee6d435a35d51081ded97ff7ce53be5942')
		eYETI = await Strategy.attach('0xA6A6550CbAf8CCd944f3Dd41F2527d441999238c')
		eYLA = await Strategy.attach('0xb41a7a429c73aa68683da1389051893fe290f614')

    const eDPIManagerAddress = await eDPI.manager()
    await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [eDPIManagerAddress],
    })
    const eDPIManager = await ethers.getSigner(eDPIManagerAddress)

    const eYETIManagerAddress = await eYETI.manager()
    await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [eYETIManagerAddress],
    })
    const eYETIManager = await ethers.getSigner(eYETIManagerAddress)
    
    const eYLAManagerAddress = await eYLA.manager()
    await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [eYLAManagerAddress],
    })
    const eYLAManager = await ethers.getSigner(eYLAManagerAddress)
    
    const StrategyProxyAdmin = await getContractFactory("StrategyProxyAdmin")
    const strategyProxyAdmin = await StrategyProxyAdmin.attach(await enso.platform.strategyFactory.admin())

    await strategyProxyAdmin.connect(eDPIManager).upgrade(eDPI.address)
    await strategyProxyAdmin.connect(eYETIManager).upgrade(eYETI.address)
    await strategyProxyAdmin.connect(eYLAManager).upgrade(eYLA.address)
	})

	it('Should estimate deposit eDPI', async function() {
		const [ totalBefore, ] = await oracle.estimateStrategy(eDPI.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eDPI, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller.connect(accounts[1]).deposit(eDPI.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [ totalAfter ] = await oracle.estimateStrategy(eDPI.address)
		console.log('Actual deposit value: ', totalAfter[0].sub(totalBefore[0]).toString())
	})

	it('Should estimate deposit eYETI', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle.estimateStrategy(eYETI.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eYETI, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller.connect(accounts[1]).deposit(eYETI.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [ totalAfter ] = await oracle.estimateStrategy(eYETI.address)
		console.log('Actual deposit value: ', totalAfter[0].sub(totalBefore[0]).toString())
	})

	it('Should estimate deposit eYLA', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle.estimateStrategy(eYLA.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eYLA, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller.connect(accounts[1]).deposit(eYLA.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [ totalAfter ] = await oracle.estimateStrategy(eYLA.address)
		console.log('Actual deposit value: ', totalAfter[0].sub(totalBefore[0]).toString())
	})
})
