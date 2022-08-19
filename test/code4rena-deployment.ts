const runAll = false
import hre from 'hardhat'
import chai from 'chai'
const { expect } = chai
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { solidity } from 'ethereum-waffle'
const { ethers/*, waffle*/ } = hre
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
import deploymentsJSON from '../deployments.json'
import { Tokens } from '../lib/tokens'
import { prepareStrategy, StrategyItem, InitialState, TradeData } from '../lib/encode'
import { DIVISOR, MAINNET_ADDRESSES, ESTIMATOR_CATEGORY, ITEM_CATEGORY } from '../lib/constants'
import { increaseTime, impersonate } from '../lib/utils'
import { Estimator } from '../lib/estimator'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
//import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
//import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'

import { initializeTestLogging, logTestComplete } from '../lib/convincer'

chai.use(solidity)
describe('Code4rena deployment', function () {
	let proofCounter: number,
    multisig: SignerWithAddress,
    whitelist: Contract,
		contracts: { [key: string]: string },
		tokens: Tokens,
		weth: Contract,
		estimator: Estimator, // TODO update to use Lens
		dai: Contract,
		accounts: SignerWithAddress[],
		router: Contract,
		strategyFactory: Contract,
		controller: Contract,
		oracle: Contract,
		//uniswapV2Factory: Contract,
		uniswapV2Adapter: Contract,
		//uniswapV3Adapter: Contract,
		compoundAdapter: Contract,
		eDPI: Contract,
		eYETI: Contract,
		eYLA: Contract,
		eNFTP: Contract,
		eETH2X: Contract,
		oldAdapters: string[],
		newAdapters: string[],
		//curveAdapter: Contract,
		curveLPAdapter: Contract,
		curveGaugeAdapter: Contract,
		//crvLINKGauge: Contract,
		//rewardsToken: Contract,
		//stakingRewards: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		wrapper: Contract

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

	before('Deploy new contracts.', async function () {
		proofCounter = initializeTestLogging(this, __dirname)

		accounts = await getSigners()
		//uniswapV2Factory = new Contract(MAINNET_ADDRESSES.UNISWAP_V2_FACTORY, UniswapV2Factory.abi, accounts[0])

    const deployments: { [key: string]: { [key: string]: string } } = deploymentsJSON
    // If true it will deploy contract regardless of whether there is an address currently on the network
    let network: string
    if (process.env.HARDHAT_NETWORK) {
      network = process.env.HARDHAT_NETWORK
      //ts-ignore
      if (deployments[network]) contracts = deployments[network]
    }
		tokens = new Tokens()
		strategyFactory = new Contract(
			contracts['StrategyProxyFactory'],
			(await getContractFactory('StrategyProxyFactory')).interface,
			accounts[0]
		)
    // these have happened in scripts !!
		//await deployCode4renaFixes()
		//await registerTokens()
    //await registerUniswapPools()
    //await registerCurvePools()
    //await registerChainlinkOracles()
		//await transferOwnership()
    
    //TODO multi-sig tasks

    // whitelist new adapters and router
    whitelist = (await getContractFactory('Whitelist')).attach(contracts['Whitelist'])
    multisig = await impersonate(await whitelist.callStatic.owner())
    const deprecatedAdaptersNames = Object.keys(contracts).filter(name => {
        return name.indexOf('Adapter') > -1 && name.indexOf('DEPRECATED') > -1 && name.indexOf('DEPRECATED_2') < 0
    })
		const newAdaptersNames = Object.keys(contracts).filter(name => { 
        return deprecatedAdaptersNames.includes(name+'_DEPRECATED') 
    })
    newAdapters = []
    oldAdapters = []
    for (let i = 0; i < newAdaptersNames.length; ++i) {
        newAdapters.push(contracts[newAdaptersNames[i]])
        oldAdapters.push(contracts[newAdaptersNames[i]+'_DEPRECATED'])
    }
    console.log({newAdapters})
    console.log({oldAdapters})
    let toWhitelist = ['']
    toWhitelist.pop()
    newAdapters.forEach(a => { toWhitelist.push(a)})
    toWhitelist.push(contracts['LoopRouter'])
    toWhitelist.push(contracts['FullRouter'])

    for (let i = 0; i < toWhitelist.length; ++i) {
        if (!(await whitelist.callStatic.approved(toWhitelist[i]))) await whitelist.connect(multisig).approve(toWhitelist[i])
    }
    console.log("approved adapters", newAdapters)
    console.log("approved routers", contracts['LoopRouter'], contracts['FullRouter'])

    const platformProxyAdmin = (await getContractFactory('PlatformProxyAdmin')).attach(contracts['PlatformProxyAdmin'])
		await platformProxyAdmin.connect(multisig).upgrade(contracts['StrategyController'], contracts['StrategyControllerImplementation'])

		await platformProxyAdmin.connect(multisig).upgrade(contracts['StrategyProxyFactory'], contracts['StrategyProxyFactoryImplementation'])

    console.log("platformProxyAdmin upgrades StrategyController and StrategyProxyFactory")
    
    console.log(contracts['EnsoOracle'])
    await strategyFactory.connect(multisig).updateOracle(contracts['EnsoOracle'])
    await strategyFactory.connect(multisig).updateRegistry(contracts['TokenRegistry'])
    await strategyFactory.connect(multisig).updateImplementation(contracts['StrategyImplementation'], ((await strategyFactory.callStatic.version())+1).toString())
    console.log("strategyFactory updates oracle and tokenRegistry")
		oracle = new Contract(contracts['EnsoOracle'], (await getContractFactory('EnsoOracle')).interface, accounts[0])
		controller = new Contract(
			contracts['StrategyController'],
			(
				await getContractFactory('StrategyController', {
					libraries: {
						ControllerLibrary: contracts['ControllerLibrary'],
					},
				})
			).interface,
			accounts[0]
		)
    await controller.connect(accounts[3]).updateAddresses() // anyone
		uniswapV2Adapter = new Contract(
			contracts['UniswapV2Adapter'],
			(await getContractFactory('UniswapV2Adapter')).interface,
			accounts[0]
		)
		/*uniswapV3Adapter = new Contract(
			contracts['UniswapV3Adapter'],
			(await getContractFactory('UniswapV3Adapter')).interface,
			accounts[0]
		)*/
		compoundAdapter = new Contract(
			contracts['CompoundAdapter'],
			(await getContractFactory('CompoundAdapter')).interface,
			accounts[0]
		)
		curveLPAdapter = new Contract(
			contracts['CurveLPAdapter'],
			(await getContractFactory('CurveLPAdapter')).interface,
			accounts[0]
		)
		curveGaugeAdapter = new Contract(
			contracts['CurveGaugeAdapter'],
			(await getContractFactory('CurveGaugeAdapter')).interface,
			accounts[0]
		)

		// add claimables
		let tradeData: TradeData = {
			adapters: [],
			path: [],
			cache: '0x',
		}
		await strategyFactory
			.connect(multisig)
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.CURVE_GAUGE,
				tokens.crvLINKGauge,
				tradeData,
				curveGaugeAdapter.address
			)
		await strategyFactory
			.connect(multisig)
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.COMPOUND,
				tokens.cUSDT,
				tradeData,
				compoundAdapter.address
			)
		await strategyFactory
			.connect(multisig)
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.COMPOUND,
				tokens.cDAI,
				tradeData,
				compoundAdapter.address
			)

		// add rewards tokens
		tradeData.adapters[0] = uniswapV2Adapter.address
		await strategyFactory
			.connect(multisig)
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.DEFAULT_ORACLE,
				tokens.COMP,
				tradeData,
				AddressZero
			)
    /*
		tradeData.adapters = [uniswapV2Adapter.address]
		await strategyFactory
			.connect(multisig)
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.DEFAULT_ORACLE,
				rewardsToken.address,
				tradeData,
				AddressZero
			)
    */
	})


	it('Should debug.', async function () {
      console.log("debug hello")
  })

  if (runAll) {

	// mimic live-estimates
	it('Should update strategies.', async function () {
		const tokenRegistry = new Contract(
			contracts['TokenRegistry'],
			(await getContractFactory('TokenRegistry')).interface,
			accounts[0]
		)
		const uniswapV3Registry = new Contract(
			contracts['UniswapV3Registry'],
			(await getContractFactory('UniswapV3Registry')).interface,
			accounts[0]
		)
		const curveDepositZapRegistry = new Contract(
			contracts['CurveDepositZapRegistry'],
			(await getContractFactory('CurveDepositZapRegistry')).interface,
			accounts[0]
		)

		estimator = new Estimator(
			accounts[0],
			oracle,
			tokenRegistry,
			uniswapV3Registry,
			curveDepositZapRegistry,
			contracts['AaveV2Adapter'],
			contracts['CompoundAdapter'],
			contracts['CurveAdapter'],
			contracts['CurveLPAdapter'],
			contracts['CurveGaugeAdapter'],
			contracts['KyberSwapAdapter'],
			contracts['MetaStrategyAdapter'],
			MAINNET_ADDRESSES.SUSHI_FACTORY, // FIXME ?? is this correct?
			contracts['SynthetixAdapter'],
			contracts['UniswapV2Adapter'],
			contracts['UniswapV3Adapter'],
			contracts['YEarnAdapter']
		)
		router = new Contract(
			contracts['FullRouter'],
			(
				await getContractFactory('FullRouter', {
					libraries: {
						StrategyLibrary: contracts['StrategyLibrary'],
					},
				})
			).interface,
			accounts[0]
		)

		const Strategy = await hre.ethers.getContractFactory('Strategy', {
			libraries: {
				StrategyClaim: contracts['StrategyClaim'],
			},
		})
		console.log('strategy size:', Strategy.bytecode.length / 2 - 1)
		eYETI = await Strategy.attach('0xA6A6550CbAf8CCd944f3Dd41F2527d441999238c')
		eYLA = await Strategy.attach('0xb41a7a429c73aa68683da1389051893fe290f614')
		eNFTP = await Strategy.attach('16f7a9c3449f9c67e8c7e8f30ae1ee5d7b8ed10d')
		eETH2X = await Strategy.attach('0x81cddbf4a9d21cf52ef49bda5e5d5c4ae2e40b3e')
		eDPI = await Strategy.attach('0x890ed1ee6d435a35d51081ded97ff7ce53be5942')
		const strategies = [eDPI, eYETI, eYLA, eNFTP, eETH2X]
		// strategyFactory.updateImplementation should be updated
		const admin = await strategyFactory.admin()
		const StrategyAdmin = await getContractFactory('StrategyProxyAdmin')
		const strategyAdmin = await StrategyAdmin.attach(admin)
		for (let i = 0; i < strategies.length; i++) {
			const s = strategies[i]
			const mgr = await impersonate(await s.manager())
			await strategyAdmin.connect(mgr).upgrade(s.address)

			await updateAdapters(s)

      console.log(await strategyFactory.callStatic.tokenRegistry()) // DEBUG
			await s.connect(accounts[3]).updateRewards() // anyone calls
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
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
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
		logTestComplete(this, __dirname, proofCounter++)
	})

  }

	// deploy exotic strategy etc
	it('Should deploy "exotic" strategy', async function () {
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		router = new Contract(
			contracts['LoopRouter'],
			(
				await getContractFactory('LoopRouter', {
					libraries: {
						StrategyLibrary: contracts['StrategyLibrary'],
					},
				})
			).interface,
			accounts[0]
		)

		const name = 'Test Strategy'+(Math.random()).toString() // so test can be repeated on node
		const symbol = 'TEST'
		const positions = [
			// an "exotic" strategy
			{ token: tokens.dai, percentage: BigNumber.from(200) },
			{ token: tokens.crv, percentage: BigNumber.from(0) },
       /*{
        token: tokens.crvEURS,
        percentage: BigNumber.from(200), // FIXME
        adapters: [uniswapV3Adapter.address, uniswapV3Adapter.address, curveLPAdapter.address],
        path: [tokens.usdc, tokens.eurs],
      },*/

			{
				token: tokens.crvLINKGauge,
				percentage: BigNumber.from(400),
				adapters: [uniswapV2Adapter.address, curveLPAdapter.address, curveGaugeAdapter.address],
				path: [tokens.link, tokens.crvLINK],
			},
			{
				token: tokens.cUSDT,
				percentage: BigNumber.from(200),
				adapters: [uniswapV2Adapter.address, compoundAdapter.address],
				path: [tokens.usdt],
			},
			{
				token: tokens.cDAI,
				percentage: BigNumber.from(200),
				adapters: [uniswapV2Adapter.address, compoundAdapter.address],
				path: [tokens.dai],
			},
		]
		strategyItems = prepareStrategy(positions, uniswapV2Adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(990), 
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}
		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy

		const Strategy = await hre.ethers.getContractFactory('Strategy', {
			libraries: {
				StrategyClaim: contracts['StrategyClaim'],
			},
		})

		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: contracts['StrategyLibrary'],
				ControllerLibrary: contracts['ControllerLibrary'],
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should set strategy and updateRewards', async function () {
    
		await accounts[19].sendTransaction({ to: accounts[0].address, value: WeiPerEther.mul(100) })
		await accounts[19].sendTransaction({ to: accounts[1].address, value: WeiPerEther.mul(100) })

		await expect(controller.connect(accounts[1]).setStrategy(strategy.address)).to.emit(controller, 'StrategySet')

		// setting up rewards
		/*rewardsToken = await waffle.deployContract(accounts[0], ERC20, [WeiPerEther.mul(100)])

		stakingRewards = await (
			await getContractFactory('StakingRewards')
		).deploy(accounts[0].address, accounts[0].address, rewardsToken.address, tokens.crvLINK) //, crvLINKGauge)
		const ownerBalance = await rewardsToken.balanceOf(accounts[0].address)

		await uniswapV2Factory.createPair(rewardsToken.address, tokens.weth)

		const pairAddress = await uniswapV2Factory.getPair(rewardsToken.address, tokens.weth)
		const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), accounts[0])
		await rewardsToken.connect(accounts[0]).transfer(pairAddress, ownerBalance.mul(2).div(3))

		await weth.connect(accounts[0]).deposit({ value: ownerBalance.div(3) })

		await weth.connect(accounts[0]).transfer(pairAddress, ownerBalance.div(3))

		await pair.connect(accounts[0]).mint(accounts[0].address)

		await rewardsToken.connect(accounts[0]).transfer(stakingRewards.address, ownerBalance.div(3))

		await stakingRewards.connect(accounts[0]).notifyRewardAmount(ownerBalance.div(3))
		/*let stakeSig = stakingRewards.interface.getSighash('stake')
		let withdrawSig = stakingRewards.interface.getSighash('withdraw')
		let claimSig = stakingRewards.interface.getSighash('getReward')
		/*let sigs =
			'0x' + stakeSig.substring(2) + withdrawSig.substring(2) + claimSig.substring(2) + AddressZero.substring(2)
		/*let rewardTokens = [rewardsToken.address]
		while (rewardTokens.length < 8) {
			rewardTokens.push(AddressZero)
		}

		crvLINKGauge = new Contract(
			tokens.crvLINKGauge,
			[
				{
					constant: false,
					inputs: [
						{
							internalType: 'address',
							name: '_rewardContract',
							type: 'address',
						},
						{
							internalType: 'bytes32',
							name: '_sigs',
							type: 'bytes32',
						},
						{
							internalType: 'address[8]',
							name: '_reward_tokens',
							type: 'address[8]',
						},
					],
					name: 'set_rewards',
					outputs: [],
					payable: false,
					stateMutability: 'nonpayable',
					type: 'function',
				},
				{
					constant: true,
					inputs: [],
					name: 'admin',
					outputs: [
						{
							internalType: 'address',
							name: '',
							type: 'address',
						},
					],
					payable: false,
					stateMutability: 'view',
					type: 'function',
				},
			],
			accounts[0]
		)

		const gaugeAdminProxy = new Contract(
			await crvLINKGauge.admin(),
			[
				{
					constant: false,
					inputs: [
						{
							internalType: 'address',
							name: '_gauge',
							type: 'address',
						},
						{
							internalType: 'address',
							name: '_rewardContract',
							type: 'address',
						},
						{
							internalType: 'bytes32',
							name: '_sigs',
							type: 'bytes32',
						},
						{
							internalType: 'address[8]',
							name: '_reward_tokens',
							type: 'address[8]',
						},
					],
					name: 'set_rewards',
					outputs: [],
					payable: false,
					stateMutability: 'nonpayable',
					type: 'function',
				},
				{
					constant: true,
					inputs: [],
					name: 'ownership_admin',
					outputs: [
						{
							internalType: 'address',
							name: '',
							type: 'address',
						},
					],
					payable: false,
					stateMutability: 'view',
					type: 'function',
				},
			],
			accounts[0]
		)

		const ownershipAdminAddress = await gaugeAdminProxy.ownership_admin()
		await gaugeAdminProxy
			.connect(await impersonate(ownershipAdminAddress))
			['set_rewards'](crvLINKGauge.address, stakingRewards.address, sigs, rewardTokens)

		let tradeData: TradeData = {
			adapters: [],
			path: [],
			cache: '0x',
		}
		tradeData.adapters[0] = uniswapV2Adapter.address
		await strategyFactory
			.connect(multisig)
			.addItemDetailedToRegistry(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.DEFAULT_ORACLE,
				rewardsToken.address,
				tradeData,
				AddressZero
			)
      */
    /*
		const oldItems = await strategy.connect(accounts[1]).items()
		await strategy.connect(accounts[1]).updateRewards()
		const newItems = await strategy.connect(accounts[1]).items()
		const oldItemsLength = oldItems.length
		const newItemsLength = newItems.length

		expect(newItemsLength).to.be.gt(oldItemsLength)
    */
		//expect(oldItems.indexOf(rewardsToken.address)).to.be.equal(-1)
		//expect(newItems.indexOf(rewardsToken.address)).to.be.gt(-1)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should deploy "exotic" strategy', async function () {
		const name = 'Test Strategy2'+(Math.random()).toString() // so test can be repeated on node
		const symbol = 'TEST2'
		const positions = [
			// an "exotic" strategy
			{ token: tokens.dai, percentage: BigNumber.from(200) },
			{ token: tokens.crv, percentage: BigNumber.from(0) },
			{
				token: tokens.crvLINKGauge,
				percentage: BigNumber.from(400),
				adapters: [uniswapV2Adapter.address, curveLPAdapter.address, curveGaugeAdapter.address],
				path: [tokens.link, tokens.crvLINK],
			},
			{
				token: tokens.cUSDT,
				percentage: BigNumber.from(200),
				adapters: [uniswapV2Adapter.address, compoundAdapter.address],
				path: [tokens.usdt],
			},
			{
				token: tokens.cDAI,
				percentage: BigNumber.from(200),
				adapters: [uniswapV2Adapter.address, compoundAdapter.address],
				path: [tokens.dai],
			},
		]
		strategyItems = prepareStrategy(positions, uniswapV2Adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(990),
			restructureSlippage: BigNumber.from(980), 
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}
		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await hre.ethers.getContractFactory('Strategy', {
			libraries: {
				StrategyClaim: contracts['StrategyClaim'],
			},
		})
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: contracts['StrategyLibrary'],
				ControllerLibrary: contracts['ControllerLibrary'],
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		const value = WeiPerEther.mul(10000)
		await weth.connect(accounts[19]).deposit({ value: value })
    await weth.connect(accounts[19]).transfer(strategy.address, value)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

  //if (runAll) {

	it('Should deposit more: ETH', async function () {
		const balanceBefore = await strategy.balanceOf(accounts[1].address)
		//console.log(DEFAULT_DEPOSIT_SLIPPAGE)
		const tx = await controller
			.connect(accounts[1])
			.deposit(strategy.address, router.address, 0, BigNumber.from(980), '0x', {
				value: BigNumber.from('10000000000000000'),
			})
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const balanceAfter = await strategy.balanceOf(accounts[1].address)
		//await displayBalances(wrapper, strategyItems, weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		expect(balanceAfter.gt(balanceBefore)).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should claim rewards', async function () {
		const rewardsTokens = await strategy.callStatic.getAllRewardTokens()
		const rewardsTokensLength = rewardsTokens.length
    console.log({rewardsTokens})
		expect(rewardsTokensLength).to.be.gt(0)
		let balancesBefore = []
		for (let i = 0; i < rewardsTokens.length; ++i) {
			const rewardsToken = new Contract(rewardsTokens[i], ERC20.abi, accounts[0])
			const balanceBefore = await rewardsToken.balanceOf(strategy.address)
			balancesBefore.push(balanceBefore)
		}
		await increaseTime(3 * 60) // 3 hrs
		const tx = await strategy.connect(accounts[1]).claimAll()
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		for (let i = 0; i < rewardsTokens.length; ++i) {
			const rewardsToken = new Contract(rewardsTokens[i], ERC20.abi, accounts[0])
			const balanceAfter = await rewardsToken.balanceOf(strategy.address)
			expect(balanceAfter).to.be.gt(balancesBefore[i])
		}
		logTestComplete(this, __dirname, proofCounter++)
	})
	
  it('Should deploy strategy with ETH + BTC', async function () {
		const name = 'Curve ETHBTC Strategy'
		const symbol = 'ETHBTC'
		const positions = [
			{ token: dai.address, percentage: BigNumber.from(400) },
			{
				token: tokens.crvREN,
				percentage: BigNumber.from(400),
				adapters: [uniswapV2Adapter.address, curveLPAdapter.address],
				path: [tokens.wbtc],
			},
			{
				token: tokens.crvSETH,
				percentage: BigNumber.from(200),
				adapters: [uniswapV2Adapter.address, curveLPAdapter.address],
				path: [tokens.sETH],
			},
		]
		strategyItems = prepareStrategy(positions, uniswapV2Adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(980), // Needs to tolerate more slippage
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}
		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await hre.ethers.getContractFactory('Strategy', {
			libraries: {
				StrategyClaim: contracts['StrategyClaim'],
			},
		})
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: contracts['StrategyLibrary'],
				ControllerLibrary: contracts['ControllerLibrary'],
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		const value = WeiPerEther.mul(10000)
		await weth.connect(accounts[19]).deposit({ value: value })
    await weth.connect(accounts[19]).transfer(strategy.address, value)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		const value = WeiPerEther.mul(10000)
		await weth.connect(accounts[19]).deposit({ value: value })
    await weth.connect(accounts[19]).transfer(strategy.address, value)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should deploy strategy with Curve metapool', async function () {
		const name = 'Curve MetaPool Strategy'
		const symbol = 'META'
		const positions = [
			{ token: dai.address, percentage: BigNumber.from(500) },
			{
				token: tokens.crvUSDN, //Metapool uses 3crv as a liquidity token
				percentage: BigNumber.from(500),
				adapters: [uniswapV2Adapter.address, curveLPAdapter.address, curveLPAdapter.address],
				path: [tokens.usdc, tokens.crv3],
			},
		]
		strategyItems = prepareStrategy(positions, uniswapV2Adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(50),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(980),
			managementFee: BigNumber.from(0),
			social: false,
			set: false,
		}
		const tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(name, symbol, strategyItems, strategyState, router.address, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await hre.ethers.getContractFactory('Strategy', {
			libraries: {
				StrategyClaim: contracts['StrategyClaim'],
			},
		})
		strategy = await Strategy.attach(strategyAddress)

		expect(await controller.initialized(strategyAddress)).to.equal(true)

		const LibraryWrapper = await getContractFactory('LibraryWrapper', {
			libraries: {
				StrategyLibrary: contracts['StrategyLibrary'],
				ControllerLibrary: contracts['ControllerLibrary'],
			},
		})
		wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress, controller.address)
		await wrapper.deployed()

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should purchase a token, requiring a rebalance of strategy', async function () {
		const value = WeiPerEther.mul(10000)
		await weth.connect(accounts[19]).deposit({ value: value })
    await weth.connect(accounts[19]).transfer(strategy.address, value)

		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(false)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should rebalance strategy', async function () {
		await increaseTime(5 * 60 + 1)
		const tx = await controller.connect(accounts[1]).rebalance(strategy.address, router.address, '0x')
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		//await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		expect(await wrapper.isBalanced()).to.equal(true)
		logTestComplete(this, __dirname, proofCounter++)
	})
//  }
})
