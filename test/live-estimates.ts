import { ethers, waffle, network } from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Estimator } from '../lib/estimator'
import { Tokens } from '../lib/tokens'
import { getLiveContracts } from '../lib/mainnet'
import { increaseTime } from '../lib/utils'
import { deployLoopRouter/*, deployUniswapV3Adapter*/ } from '../lib/deploy'
import { DIVISOR } from '../lib/constants'
import { createLink, linkBytecode } from '../lib/link'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'

const { constants, getSigners, getContractFactory } = ethers
const { WeiPerEther, AddressZero } = constants

import StrategyController from '../artifacts/contracts/StrategyController.sol/StrategyController.json'
import StrategyLibrary from '../artifacts/contracts/libraries/StrategyLibrary.sol/StrategyLibrary.json'
//import SwapRouter from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
//const uniswapV3SwapRouterAddress = '0xE592427A0AEce92De3Edee1F18E0157C05861564'

const ownerAddress = '0xca702d224D61ae6980c8c7d4D98042E22b40FFdB'

const runAll = false 

describe('Live Estimates', function () {
	let	accounts: SignerWithAddress[],
		estimator: Estimator,
		tokens: Tokens,
		weth: Contract,
		router: Contract,
		controller: Contract,
    controllerLens: Contract,
		oracle: Contract,
		eDPI: Contract,
		eYETI: Contract,
		eYLA: Contract,
		eNFTP: Contract

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

    async function impersonate(address: string) : Promise<SignerWithAddress> {
        await network.provider.request({
          method: 'hardhat_impersonateAccount',
          params: [address],
        });
        return await ethers.getSigner(address);
    }

    //await impersonate(await eDPI.manager())

    async function impersonateManager(strategyContract: Contract) : Promise<SignerWithAddress> {
        return await impersonate(await strategyContract.manager())
    }

    /*async function updateTradeData(strategyContract: Contract) { // FIXME pass in old address
        const items = await strategyContract.items()
        for (var i=0; i<items.length; i++) {
            const tradeData = await strategyContract.getTradeData(items[i]); 
            let changed = false
            let newTradeData = {
                adapters: [''],
                path: tradeData.path,
                cache: tradeData.cache 
            }
            newTradeData.adapters.pop() // was to invoke type
            for (var j=0; j<tradeData.adapters.length; j++) {
                if (tradeData.adapters[j].toLowerCase() == oldUniswapV3Address.toLowerCase()) {
                    newTradeData.adapters.push(enso.adapters.uniswapV3.address)
                    changed = true
                } else {
                    newTradeData.adapters.push(tradeData.adapters[j])
                }
            }
            if (changed) {
                await strategyContract.connect(await impersonateManager(strategyContract)).updateTradeData(items[i], newTradeData)
            }
        }
    }*/

		const Strategy = await getContractFactory('Strategy')
		eDPI = await Strategy.attach('0x890ed1ee6d435a35d51081ded97ff7ce53be5942')
		eYETI = await Strategy.attach('0xA6A6550CbAf8CCd944f3Dd41F2527d441999238c')
		eYLA = await Strategy.attach('0xb41a7a429c73aa68683da1389051893fe290f614')
		eNFTP = await Strategy.attach('16f7a9c3449f9c67e8c7e8f30ae1ee5d7b8ed10d')

		// Impersonate owner
    const owner = await impersonate(ownerAddress)
		// Deploy new router
		router = await deployLoopRouter(accounts[0], controller, enso.platform.library)
		// Whitelist
		await enso.platform.administration.whitelist.connect(owner).approve(router.address)

    // update controller and other contracts of this changeset
		const platformProxyAdmin = enso.platform.administration.platformProxyAdmin

		//const strategyController = await StrategyController.deploy(enso.platform.strategyFactory.address)
    //
    const StrategyControllerLens = await getContractFactory("StrategyControllerLens")
    controllerLens = await StrategyControllerLens.deploy(controller.address)
    await controllerLens.deployed()

    const strategyLibrary = await waffle.deployContract(accounts[0], StrategyLibrary, [])
    await strategyLibrary.deployed()
    const strategyLibraryLink = createLink(StrategyLibrary, strategyLibrary.address)
    const controllerImplementation = await waffle.deployContract(
      accounts[0],
      linkBytecode(StrategyController, [strategyLibraryLink]),
      [enso.platform.strategyFactory.address, controllerLens.address]
    )
    await controllerImplementation.deployed()
		//const controllerProxy = await platformProxyAdmin.controller()
		await platformProxyAdmin.connect(owner).upgrade(controller.address, controllerImplementation.address)


    const newStrategyImplementation = await Strategy.deploy(enso.platform.strategyFactory.address, controller.address, AddressZero, AddressZero) // FIXME do we need these last two as non-zero??
		const version = parseInt(await enso.platform.strategyFactory.version());
		await enso.platform.strategyFactory.connect(owner).updateImplementation(newStrategyImplementation.address, (version+1).toString())
		const strategyAdminAddress = await enso.platform.strategyFactory.admin()
		const StrategyAdmin = await getContractFactory('StrategyProxyAdmin')
		const strategyAdmin = await StrategyAdmin.attach(strategyAdminAddress)
		await strategyAdmin.connect(await impersonateManager(eDPI)).upgrade(eDPI.address)
		await strategyAdmin.connect(await impersonateManager(eYETI)).upgrade(eYETI.address)
		await strategyAdmin.connect(await impersonateManager(eYLA)).upgrade(eYLA.address)
		await strategyAdmin.connect(await impersonateManager(eNFTP)).upgrade(eNFTP.address)
    /*
    let oldUniswapV3Address = enso.adapters.uniswapV3.address
    const uniswapV3SwapRouter = new Contract(uniswapV3SwapRouterAddress, SwapRouter.abi, accounts[0])
		enso.adapters.uniswapV3 = await deployUniswapV3Adapter(owner, enso.platform.oracles.registries.uniswapV3Registry, uniswapV3SwapRouter, weth)
		await enso.platform.administration.whitelist.connect(owner).approve(enso.adapters.uniswapV3.address)

    // FIXME don't need to deploy uni v3.. review and delete much of this section
    await updateTradeData(eDPI)
    */
	})

	it('Should estimate deposit eDPI', async function() {
		const [ totalBefore, ] = await oracle['estimateStrategy(address)'](eDPI.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eDPI, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller.connect(accounts[1]).deposit(eDPI.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [ totalAfter ] = await oracle['estimateStrategy(address)'](eDPI.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})

  //if (runAll) {

	it('Should estimate withdraw eDPI', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle['estimateStrategy(address)'](eDPI.address)
		const withdrawAmount = await eDPI.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await eDPI.totalSupply()
	//	const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())

		const estimatedWithdrawValue = await estimator.withdraw(eDPI, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
    
    console.log("debug before")
    const estimatedWithdrawValue2 = await controllerLens.connect(accounts[1]).callStatic.estimateWithdrawWETH(eDPI.address, router.address, withdrawAmount, 0, '0x')
    console.log("debug after")
    console.log('Estimated withdraw value2: ', estimatedWithdrawValue2.toString())
    
  /*
		let tx = await controller.connect(accounts[1]).withdrawWETH(eDPI.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
    */
	})

  if (runAll) {

	it('Should estimate deposit eYETI', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle['estimateStrategy(address)'](eYETI.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eYETI, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller.connect(accounts[1]).deposit(eYETI.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [ totalAfter ] = await oracle['estimateStrategy(address)'](eYETI.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})

	it('Should estimate withdraw eYETI', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle['estimateStrategy(address)'](eYETI.address)
		const withdrawAmount = await eYETI.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await eYETI.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eYETI, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())

    console.log("debug before")
    const estimatedWithdrawValue2 = await controllerLens.connect(accounts[1]).estimateWithdrawWETH(eYETI.address, router.address, withdrawAmount, 0, '0x')
    console.log("debug after")
    console.log('Estimated withdraw value2: ', estimatedWithdrawValue2.toString())

		let tx = await controller.connect(accounts[1]).withdrawWETH(eYETI.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
	})

	it('Should estimate deposit eYLA', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle['estimateStrategy(address)'](eYLA.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eYLA, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller.connect(accounts[1]).deposit(eYLA.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [ totalAfter ] = await oracle['estimateStrategy(address)'](eYLA.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})

	it('Should estimate withdraw eYLA', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle['estimateStrategy(address)'](eYLA.address)
		const withdrawAmount = await eYLA.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await eYLA.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eYLA, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())

    console.log("debug before")
    const estimatedWithdrawValue2 = await controllerLens.connect(accounts[1]).estimateWithdrawWETH(eYLA.address, router.address, withdrawAmount, 0, '0x')
    console.log("debug after")
    console.log('Estimated withdraw value2: ', estimatedWithdrawValue2.toString())

		let tx = await controller.connect(accounts[1]).withdrawWETH(eYLA.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
	})

	it('Should estimate deposit eNFTP', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle['estimateStrategy(address)'](eNFTP.address)
		const depositAmount = WeiPerEther
		const estimatedDepositValue = await estimator.deposit(eNFTP, depositAmount)
		console.log('Estimated deposit value: ', estimatedDepositValue.toString())
		await controller.connect(accounts[1]).deposit(eNFTP.address, router.address, 0, 0, '0x', { value: depositAmount })
		const [ totalAfter ] = await oracle['estimateStrategy(address)'](eNFTP.address)
		console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
	})

	it('Should estimate withdraw eNFTP', async function() {
		await increaseTime(1)
		const [ totalBefore, ] = await oracle['estimateStrategy(address)'](eNFTP.address)
		const withdrawAmount = await eNFTP.balanceOf(accounts[1].address)
		const withdrawAmountAfterFee = withdrawAmount.sub(withdrawAmount.mul(2).div(DIVISOR)) // 0.2% withdrawal fee
		const totalSupply = await eNFTP.totalSupply()
		const wethBefore = await weth.balanceOf(accounts[1].address)
		const expectedWithdrawValue = totalBefore.mul(withdrawAmountAfterFee).div(totalSupply)
		console.log('Expected withdraw value: ', expectedWithdrawValue.toString())
		const estimatedWithdrawValue = await estimator.withdraw(eNFTP, withdrawAmountAfterFee)
		console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())

    console.log("debug before")
    const estimatedWithdrawValue2 = await controllerLens.connect(accounts[1]).estimateWithdrawWETH(eNFTP.address, router.address, withdrawAmount, 0, '0x')
    console.log("debug after")
    console.log('Estimated withdraw value2: ', estimatedWithdrawValue2.toString())

		let tx = await controller.connect(accounts[1]).withdrawWETH(eNFTP.address, router.address, withdrawAmount, 0, '0x')
		const receipt = await tx.wait()
		console.log('Withdraw Gas Used: ', receipt.gasUsed.toString())
		const wethAfter = await weth.balanceOf(accounts[1].address)
		console.log('Actual withdraw amount: ', wethAfter.sub(wethBefore).toString())
	})
  }
})
