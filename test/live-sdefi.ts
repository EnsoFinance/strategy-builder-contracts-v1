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
import { DIVISOR, MAINNET_ADDRESSES, ITEM_CATEGORY, ESTIMATOR_CATEGORY, VIRTUAL_ITEM } from '../lib/constants'
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
		manager: SignerWithAddress,
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
		await accounts[19].sendTransaction({ to: ownerAddress, value: WeiPerEther.mul(5) })

		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])

		const enso = getLiveContracts(accounts[0])
		controller = enso.platform.controller

		//chainlinkRegistry = enso.platform.oracles.registries.chainlinkRegistry

		// Deploy SynthRedeemerAdapter
		const SynthRedeemerAdapter = await getContractFactory('SynthRedeemerAdapter')
		const synthRedeemerAdapter = await SynthRedeemerAdapter.deploy(synthRedeemer, tokens.sUSD, weth.address)
		await synthRedeemerAdapter.deployed()
		// Deploy new router
		router = await deployFullRouter(
			accounts[0],
			new Contract(MAINNET_ADDRESSES.AAVE_ADDRESS_PROVIDER, [], accounts[0]),
			controller,
			enso.platform.strategyLibrary
		)
		// Whitelist
		await enso.platform.administration.whitelist.connect(owner).approve(synthRedeemerAdapter.address)
		await enso.platform.administration.whitelist.connect(owner).approve(router.address)

		// Set synthetix adapters
		await enso.platform.strategyFactory.connect(owner).addItemDetailedToRegistry(ITEM_CATEGORY.RESERVE, ESTIMATOR_CATEGORY.BLOCKED, VIRTUAL_ITEM, { adapters: [ enso.adapters.synthetix.address, synthRedeemerAdapter.address], path: [], cache: '0x'}, false)

		const strategyClaim = await waffle.deployContract(accounts[0], StrategyClaim, [])
		await strategyClaim.deployed()

		const Strategy = await getContractFactory('Strategy', {
			libraries: { StrategyClaim: strategyClaim.address },
		})
		eDTOP = await Strategy.attach('0x0CF65Dcf23c3a67D1A220A2732B5c2F7921A30c4')
	})

	/*
	it('Should update Chainlink registry', async function () {
			await expect(oracle.estimateStrategy(eDTOP.address)).to.be.revertedWith('');
			await chainlinkRegistry.connect(owner).addOracle(tokens.sDEFI, tokens.sUSD, sDEFIAggregator, false);
			const [ total, ] = await oracle.estimateStrategy(eDTOP.address)
			console.log("eDTOP Total: ", total.toString())
	})
	*/

	it('Should reposition', async function () {
		// Impersonate manager
		const managerAddress = await eDTOP.manager()
		await network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [managerAddress],
		})
		manager = await ethers.getSigner(managerAddress)

		const [ totalBefore, ] = await oracle.estimateStrategy(eDTOP.address)
		console.log("eDTOP Total Before: ", totalBefore.toString())
		let tx = await controller
			.connect(manager)
			.repositionSynths(eDTOP.address, tokens.sDEFI)
		const receipt = await tx.wait()
		console.log('Redeem Gas Used: ', receipt.gasUsed.toString())
		const [ totalAfter, ] = await oracle.estimateStrategy(eDTOP.address)
		console.log("eDTOP Total After: ", totalAfter.toString())
	})

	/*
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
