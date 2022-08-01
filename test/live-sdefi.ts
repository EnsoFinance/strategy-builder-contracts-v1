import { ethers, network, waffle } from 'hardhat'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Tokens } from '../lib/tokens'
import { getLiveContracts } from '../lib/mainnet'
import { increaseTime } from '../lib/utils'
import {
	deployOracle,
	deployFullRouter
} from '../lib/deploy'
import { DIVISOR, MAINNET_ADDRESSES, ESTIMATOR_CATEGORY } from '../lib/constants'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'

import StrategyClaim from '../artifacts/contracts/libraries/StrategyClaim.sol/StrategyClaim.json'

const { constants, getSigners, getContractFactory } = ethers
const { WeiPerEther } = constants

const ownerAddress = '0xca702d224D61ae6980c8c7d4D98042E22b40FFdB'

const synthRedeemer = '0xe533139Af961c9747356D947838c98451015e234'
const sDEFIAggregator = '0x646F23085281Dbd006FBFD211FD38d0743884864'

describe('Remove sDEFI from live contracts', function () {
	let accounts: SignerWithAddress[],
		owner: SignerWithAddress,
		tokens: Tokens,
		weth: Contract,
		router: Contract,
		controller: Contract,
		oracle: Contract,
		chainlinkRegistry: Contract,
		eDTOP: Contract

	before('Setup contracts', async function () {
		accounts = await getSigners()
		// Impersonate owner
		await network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [ownerAddress],
		})
		owner = await ethers.getSigner(ownerAddress)

		// Send funds to owner
		await accounts[19].sendTransaction({to: ownerAddress, value: WeiPerEther.mul(5)})

		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])

		const enso = getLiveContracts(accounts[0])
		controller = enso.platform.controller

		const factory = enso.platform.strategyFactory

		chainlinkRegistry = enso.platform.oracles.registries.chainlinkRegistry

		const {
			tokenRegistry,
			uniswapV3Registry
		} = enso.platform.oracles.registries

		// Deploy new oracle
		const uniswapV3Factory: Contract = new Contract(MAINNET_ADDRESSES.UNISWAP_V3_FACTORY, [], accounts[0])
		oracle = (await deployOracle(
			owner,
			uniswapV3Factory,
			uniswapV3Factory,
			tokenRegistry,
			uniswapV3Registry,
			chainlinkRegistry,
			weth,
			new Contract(tokens.sUSD, ERC20.abi, accounts[0]),
			(estimatorCategory: number, estimatorAddress: string) => {
				return factory.connect(owner).addEstimatorToRegistry(estimatorCategory, estimatorAddress)
			}
		))[0]
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
		/*
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
		//oldAdapters = [uniswapV3.address, aaveV2.address, aaveV2Debt.address]
		// Deploy and whitelist new adapters
		const uniswapV3Router = new Contract(MAINNET_ADDRESSES.UNISWAP_V3_ROUTER, [], owner)
		const aaveAddressProvider = new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], owner)
		uniswapV3 = await deployUniswapV3Adapter(
			owner, enso.platform.oracles.registries.uniswapV3Registry,
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
		*/
		const strategyClaim = await waffle.deployContract(accounts[0], StrategyClaim, [])
		await strategyClaim.deployed()

		const Strategy = await getContractFactory('Strategy', {
			libraries: { StrategyClaim: strategyClaim.address },
		})
		eDTOP = await Strategy.attach('0x0CF65Dcf23c3a67D1A220A2732B5c2F7921A30c4')
	})

	it('Should update Chainlink registry', async function () {
			//await expect(oracle.estimateStrategy(eDTOP.address)).to.be.revertedWith('');
			//await chainlinkRegistry.connect(owner).addOracle(tokens.sDEFI, tokens.sUSD, sDEFIAggregator, false);
			//console.log("ChainlinkRegistry: ", chainlinkRegistry.address)
			const [ total, ] = await oracle.estimateStrategy(eDTOP.address)
			console.log("eDTOP Total: ", total.toString())
	})

	/*
	it('Should reposition', async function () {
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

	it('Should finalize structure', async function () {
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
	*/
})
