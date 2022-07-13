import { ethers, network, waffle } from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Estimator } from '../lib/estimator'
import { Tokens } from '../lib/tokens'
import { getLiveContracts } from '../lib/mainnet'
import { increaseTime } from '../lib/utils'
import { deployFullRouter, deployAaveV2Adapter } from '../lib/deploy'
import { DIVISOR, MAINNET_ADDRESSES, ESTIMATOR_CATEGORY } from '../lib/constants'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import { createLink, linkBytecode } from '../lib/link'

import StrategyLibrary from '../artifacts/contracts/libraries/StrategyLibrary.sol/StrategyLibrary.json'
import StrategyController from '../artifacts/contracts/StrategyController.sol/StrategyController.json'
import StrategyClaim from '../artifacts/contracts/libraries/StrategyClaim.sol/StrategyClaim.json'
import StrategyToken from '../artifacts/contracts/StrategyToken.sol/StrategyToken.json'
import StrategyProxyFactory from '../artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json'

const { constants, getSigners, getContractFactory } = ethers
const { WeiPerEther, AddressZero, MaxUint256 } = constants

const ownerAddress = '0xca702d224D61ae6980c8c7d4D98042E22b40FFdB'

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
		tokens: Tokens,
		weth: Contract,
		router: Contract,
		controller: Contract,
		oracle: Contract,
    strategyToken: Contract,
		eDPI: Contract,
		eYETI: Contract,
		eYLA: Contract,
		eNFTP: Contract,
		eETH2X: Contract,
    strategyClaim: Contract,
    aaveV2Adapter: Contract

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = new Tokens()
    weth = new Contract(tokens.weth, WETH9.abi, accounts[0])

		const enso = getLiveContracts(accounts[0])
		controller = enso.platform.controller
		oracle = enso.platform.oracles.ensoOracle

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

    strategyClaim = await waffle.deployContract(accounts[0], StrategyClaim, [])
    await strategyClaim.deployed()

		const Strategy = await getContractFactory('Strategy', { 
      libraries: { StrategyClaim: strategyClaim.address }
    })
		eDPI = await Strategy.attach('0x890ed1ee6d435a35d51081ded97ff7ce53be5942')
		eYETI = await Strategy.attach('0xA6A6550CbAf8CCd944f3Dd41F2527d441999238c')
		eYLA = await Strategy.attach('0xb41a7a429c73aa68683da1389051893fe290f614')
		eNFTP = await Strategy.attach('16f7a9c3449f9c67e8c7e8f30ae1ee5d7b8ed10d')
		eETH2X = await Strategy.attach('0x81cddbf4a9d21cf52ef49bda5e5d5c4ae2e40b3e')
    const strategies = [eDPI, eYETI, eYLA, eNFTP, eETH2X];

    const strategyFactory = enso.platform.strategyFactory

    // update to latest `Strategy`
    const strategyToken = await waffle.deployContract(accounts[0], StrategyToken, [strategyFactory.address, controller.address])
		const newImplementation = await Strategy.deploy(strategyToken.address, strategyFactory.address, controller.address, AddressZero, MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER)
		await strategyFactory.connect(
      await impersonate(await strategyFactory.owner())
    ).updateImplementation(newImplementation.address, MaxUint256.toString())

    let admin = await strategyFactory.admin();
    const StrategyAdmin = await getContractFactory('StrategyProxyAdmin')
    let strategyAdmin = await StrategyAdmin.attach(admin)
    const strategyLibrary = await waffle.deployContract(accounts[0], StrategyLibrary, [])
    await strategyLibrary.deployed()
    const strategyLibraryLink = createLink(StrategyLibrary, strategyLibrary.address)
		const platformProxyAdmin = enso.platform.administration.platformProxyAdmin

    const newControllerImplementation = await waffle.deployContract(
      accounts[0],
      linkBytecode(StrategyController, [strategyLibraryLink]),
      [strategyFactory.address]
    )
		await newControllerImplementation.deployed()
		await platformProxyAdmin.connect(
        await impersonate(await platformProxyAdmin.owner())
    ).upgrade(controller.address, newControllerImplementation.address)

    strategies.forEach(async (s : Contract) => {
        await strategyAdmin.connect(
          await impersonate(await s.manager())
        ).upgrade(s.address);
        await controller.connect(accounts[0]).migrateStrategy(s.address, [])
    })

		// Impersonate owner
		await network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [ownerAddress],
		});
		const owner = await ethers.getSigner(ownerAddress);
		// Deploy new router
		router = await deployFullRouter(accounts[0], new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], accounts[0]), controller, enso.platform.library)
		// Whitelist
		await enso.platform.administration.whitelist.connect(owner).approve(router.address)

		const aaveAddressProvider = new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], accounts[0])
		aaveV2Adapter = await deployAaveV2Adapter(accounts[0], aaveAddressProvider, controller, weth, tokenRegistry, ESTIMATOR_CATEGORY.AAVE_V2)
		await enso.platform.administration.whitelist.connect(owner).approve(aaveV2Adapter.address)
    const oldAaveAdapterAddress = '0x23085950d89d3eb169c372d70362b7a40e319701'
    for (var i = 0; i < strategies.length; ++i) {
        let items = await strategies[i].connect(accounts[0]).items()
        for (var j = 0; j < items.length; ++j) {
            let data = await strategies[i].connect(accounts[0]).getTradeData(items[j])
            let newData = {
                adapters: [''],
                path: data.path, 
                cache: '0x'
            }
            newData.adapters.pop()
            let found = false;
            for (var k = 0; k < data.adapters.length; ++k) {
                if (data.adapters[k].toLowerCase() === oldAaveAdapterAddress.toLowerCase()) {
                    newData.adapters.push(aaveV2Adapter.address)
                    found = true
                } else {
                    newData.adapters.push(data.adapters[k])
                }
            }
            if (found) {
                await strategies[i].connect(
                    await impersonate(await strategies[i].manager())
                ).updateTradeData(items[j], newData)
                await increaseTime(5*60)
                await strategies[i].connect(accounts[0]).finalizeUpdateTradeData()
            }
        }
    }
    const newStrategyFactoryImplementation = await waffle.deployContract(accounts[0], StrategyProxyFactory, [controller.address])
    await newStrategyFactoryImplementation.deployed()
		await platformProxyAdmin.connect(
        await impersonate(await platformProxyAdmin.owner())
    ).upgrade(strategyFactory.address, newStrategyFactoryImplementation.address)
	})

	it('Should estimate deposit eETH2X', async function() {
		const [ totalBefore, ] = await oracle.estimateStrategy(eETH2X.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eETH2X, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller.connect(accounts[1]).deposit(eETH2X.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [ totalAfter ] = await oracle.estimateStrategy(eETH2X.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})

	it('Should estimate withdraw eETH2X', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle.estimateStrategy(eETH2X.address)
    strategyToken = new Contract(await eETH2X.token(), StrategyToken.abi, accounts[0])
		const withdrawAmount = await strategyToken.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await strategyToken.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eETH2X, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
		let tx = await controller.connect(accounts[1]).withdrawWETH(eETH2X.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
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

	it('Should estimate withdraw eDPI', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle.estimateStrategy(eDPI.address)
    strategyToken = new Contract(await eDPI.token(), StrategyToken.abi, accounts[0])
		const withdrawAmount = await strategyToken.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await strategyToken.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eDPI, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
		let tx = await controller.connect(accounts[1]).withdrawWETH(eDPI.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
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

	it('Should estimate withdraw eYETI', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle.estimateStrategy(eYETI.address)
    strategyToken = new Contract(await eYETI.token(), StrategyToken.abi, accounts[0])
		const withdrawAmount = await strategyToken.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await strategyToken.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eYETI, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
		let tx = await controller.connect(accounts[1]).withdrawWETH(eYETI.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
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

	it('Should estimate withdraw eYLA', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle.estimateStrategy(eYLA.address)
    strategyToken = new Contract(await eYLA.token(), StrategyToken.abi, accounts[0])
		const withdrawAmount = await strategyToken.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await strategyToken.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eYLA, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
		let tx = await controller.connect(accounts[1]).withdrawWETH(eYLA.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
	})

	it('Should estimate deposit eNFTP', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle.estimateStrategy(eNFTP.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eNFTP, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller.connect(accounts[1]).deposit(eNFTP.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [ totalAfter ] = await oracle.estimateStrategy(eNFTP.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})

	it('Should estimate withdraw eNFTP', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle.estimateStrategy(eNFTP.address)
    strategyToken = new Contract(await eNFTP.token(), StrategyToken.abi, accounts[0])
		const withdrawAmount = await strategyToken.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await strategyToken.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eNFTP, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
		let tx = await controller.connect(accounts[1]).withdrawWETH(eNFTP.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
	})
})
