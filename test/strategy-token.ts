const hre = require('hardhat')
const { ethers } = hre
const chai = require('chai')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
const BigNumJs = require('bignumber.js')
import { solidity } from 'ethereum-waffle'
import { expect } from 'chai'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract, Event } from 'ethers'
import { Position, preparePermit, StrategyBuilder } from '../lib/encode'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployLoopRouter } from '../lib/deploy'

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute

let WETH: Contract

chai.use(solidity)
describe('StrategyToken', function () {
	let tokens: Contract[],
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		strategyFactory: Contract,
		controller: Contract,
		whitelist: Contract,
		router: Contract,
		oracle: Contract,
		adapter: Contract,
		strategy: Contract,
		strategyTokens: string[],
		strategyPercentages: BigNumber[],
		strategyAdapters: string[],
		amount: BigNumber,
		total: BigNumber

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[0], tokens)
		const platform = await deployPlatform(accounts[0], uniswapFactory, WETH)
		;[strategyFactory, controller, oracle, whitelist] = [
			platform.strategyFactory,
			platform.controller,
			platform.oracle,
			platform.whitelist,
		]
		adapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, WETH)
		router = await deployLoopRouter(accounts[0], controller, adapter, WETH)
		await whitelist.connect(accounts[0]).approve(router.address)
		const LockableStrategy = await getContractFactory('LockableStrategy')
		const strategyImplementation = await LockableStrategy.connect(accounts[0]).deploy()
		await strategyImplementation.deployed()
		await strategyFactory.updateImplementation(strategyImplementation.address, '2')
	})

	it('Should deploy strategy', async function () {
		const positions: Position[] = [
			{ token: tokens[1].address, percentage: BigNumber.from(200) },
			{ token: tokens[2].address, percentage: BigNumber.from(200) },
			{ token: tokens[3].address, percentage: BigNumber.from(50) },
			{ token: tokens[4].address, percentage: BigNumber.from(50) },
			{ token: tokens[5].address, percentage: BigNumber.from(50) },
			{ token: tokens[6].address, percentage: BigNumber.from(50) },
			{ token: tokens[7].address, percentage: BigNumber.from(50) },
			{ token: tokens[8].address, percentage: BigNumber.from(50) },
			{ token: tokens[9].address, percentage: BigNumber.from(50) },
			{ token: tokens[10].address, percentage: BigNumber.from(50) },
			{ token: tokens[11].address, percentage: BigNumber.from(50) },
			{ token: tokens[12].address, percentage: BigNumber.from(50) },
			{ token: tokens[13].address, percentage: BigNumber.from(50) },
			{ token: tokens[14].address, percentage: BigNumber.from(50) },
		]
		const s = new StrategyBuilder(positions, adapter.address)
		strategyTokens = s.tokens
		strategyPercentages = s.percentages
		strategyAdapters = s.adapters
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		amount = BigNumber.from('10000000000000000')
		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				'Test Strategy',
				'TEST',
				strategyTokens,
				strategyPercentages,
				false,
				0,
				REBALANCE_THRESHOLD,
				SLIPPAGE,
				TIMELOCK,
				router.address,
				data,
				{ value: amount }
			)
		let receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const LockableStrategy = await getContractFactory('LockableStrategy')
		strategy = LockableStrategy.attach(strategyAddress)
		;[total] = await oracle.estimateTotal(strategy.address, await strategy.items())
		expect(BigNumber.from(await strategy.totalSupply()).eq(total)).to.equal(true)
		expect(BigNumber.from(await strategy.balanceOf(accounts[1].address)).eq(total)).to.equal(true)
	})

	it('Should fail to verify structure: 0 address', async function () {
		const failTokens = [AddressZero, tokens[1].address]
		const failPercentages = [500, 500]
		await expect(strategy.verifyStructure(failTokens, failPercentages)).to.be.revertedWith('Invalid item addr')
	})

	it('Should fail to verify structure: out of order', async function () {
		const failTokens = [tokens[1].address, AddressZero]
		const failPercentages = [500, 500]
		await expect(strategy.verifyStructure(failTokens, failPercentages)).to.be.revertedWith('Item ordering')
	})

	it('Should fail to verify structure: no percentage', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(1000) },
			{ token: tokens[2].address, percentage: BigNumber.from(0) },
		]
		const s = new StrategyBuilder(positions, adapter.address)
		const [failTokens, failPercentages] = [s.tokens, s.percentages]
		await expect(strategy.verifyStructure(failTokens, failPercentages)).to.be.revertedWith('0 percentage provided')
	})

	it('Should get name', async function () {
		expect(await strategy.name()).to.equal('Test Strategy')
	})

	it('Should get symbol', async function () {
		expect(await strategy.symbol()).to.equal('TEST')
	})

	it('Should get decimals', async function () {
		expect(BigNumber.from(await strategy.decimals()).toString()).to.equal('18')
	})

	it('Should fail to transfer tokens: insufficient funds', async function () {
		const tooMuch = total.mul(2)
		await expect(strategy.connect(accounts[1]).transfer(accounts[2].address, tooMuch)).to.be.revertedWith('')
	})

	it('Should fail to transfer tokens: zero recipient', async function () {
		await expect(strategy.connect(accounts[1]).transfer(AddressZero, amount)).to.be.revertedWith('')
	})

	it('Should transfer tokens', async function () {
		amount = total.div(2)
		await strategy.connect(accounts[1]).transfer(accounts[2].address, amount)
		expect(BigNumber.from(await strategy.balanceOf(accounts[2].address)).eq(amount)).to.equal(true)
	})

	it('Should fail to approve tokens: zero spender', async function () {
		await expect(strategy.connect(accounts[1]).approve(AddressZero, amount)).to.be.revertedWith('')
	})

	it('Should approve tokens', async function () {
		await strategy.connect(accounts[1]).approve(accounts[2].address, amount)
		expect(BigNumber.from(await strategy.allowance(accounts[1].address, accounts[2].address)).eq(amount)).to.equal(
			true
		)
	})

	it('Should fail to transferFrom tokens: zero spender', async function () {
		await expect(
			strategy.connect(accounts[2]).transferFrom(AddressZero, accounts[2].address, amount)
		).to.be.revertedWith('')
	})

	it('Should fail to transferFrom tokens: zero recipient', async function () {
		await expect(
			strategy.connect(accounts[2]).transferFrom(accounts[1].address, AddressZero, amount)
		).to.be.revertedWith('')
	})

	it('Should transferFrom tokens', async function () {
		expect(await strategy.balanceOf(accounts[1].address)).to.eq(amount)
		expect(await strategy.allowance(accounts[1].address, accounts[2].address)).to.eq(amount)
		await strategy.connect(accounts[2]).transferFrom(accounts[1].address, accounts[2].address, amount)
		expect(BigNumber.from(await strategy.balanceOf(accounts[2].address)).eq(amount.mul(2))).to.equal(true)
		expect(BigNumber.from(await strategy.balanceOf(accounts[1].address)).eq(0)).to.equal(true)
	})

	it('Should fail to mint tokens: not controller', async function () {
		await expect(strategy.connect(accounts[3]).mint(accounts[3].address, 1)).to.be.revertedWith('Controller only')
	})

	it('Should fail to update manager: not manager', async function () {
		await expect(strategy.connect(accounts[2]).updateManager(accounts[2].address)).to.be.revertedWith('')
	})
	/*
	  it('Should fail to update manager: zero address', async function() {
	    await expect(strategy.connect(accounts[1]).updateManager(AddressZero)).to.be.revertedWith()
	  })
	  */

	it('Should update manager', async function () {
		await strategy.connect(accounts[1]).updateManager(accounts[2].address)
		expect(await strategy.manager()).to.equal(accounts[2].address)
	})
	/*
	  it('Should fail to renounce ownership: not owner', async function() {
	    await expect(strategy.connect(accounts[1]).renounceOwnership()).to.be.revertedWith()
	  })

	  it('Should renounce ownership', async function() {
	    await strategy.connect(accounts[2]).renounceOwnership()
	    expect(await strategy.owner()).to.equal(AddressZero)
	  })
	  */

	it('Should fail to permit: signer not owner', async function () {
		const owner = accounts[2]
		const spender = accounts[1]
		const deadline = constants.MaxUint256

		const [name, chainId, nonce] = await Promise.all([
			strategy.name(),
			strategy.chainId(),
			strategy.nonces(owner.address),
		])
		const typedData = {
			types: {
				EIP712Domain: [
					{ name: 'name', type: 'string' },
					{ name: 'version', type: 'uint256' },
					{ name: 'chainId', type: 'uint256' },
					{ name: 'verifyingContract', type: 'address' },
				],
				Permit: [
					{ name: 'owner', type: 'address' },
					{ name: 'spender', type: 'address' },
					{ name: 'value', type: 'uint256' },
					{ name: 'nonce', type: 'uint256' },
					{ name: 'deadline', type: 'uint256' },
				],
			},
			primaryType: 'Permit',
			domain: {
				name: name,
				version: 1,
				chainId: chainId.toString(),
				verifyingContract: strategy.address,
			},
			message: {
				owner: owner.address,
				spender: spender.address,
				value: 1,
				nonce: nonce.toString(),
				deadline: deadline.toString(),
			},
		}
		//Spender tries to sign transaction instead of owner
		const { v, r, s } = ethers.utils.splitSignature(
			await ethers.provider.send('eth_signTypedData', [spender.address, typedData])
		)

		await expect(
			strategy.connect(spender).permit(owner.address, spender.address, 1, deadline, v, r, s)
		).to.be.revertedWith('Invalid signature')
	})

	it('Should fail to permit: past deadline', async function () {
		const owner = accounts[2]
		const spender = accounts[1]
		const { v, r, s } = await preparePermit(strategy, owner, spender, BigNumber.from(1), BigNumber.from(0))
		await expect(strategy.connect(owner).permit(owner.address, spender.address, 1, 0, v, r, s)).to.be.revertedWith(
			'Expired deadline'
		)
	})

	it('Should permit', async function () {
		amount = BigNumber.from(await strategy.balanceOf(accounts[2].address))
		const owner = accounts[2]
		const spender = accounts[1]
		const deadline = BigNumber.from(constants.MaxUint256)
		expect(await strategy.balanceOf(owner.address)).to.be.gte(amount);
		const { v, r, s } = await preparePermit(strategy, owner, spender, amount, deadline)
		await strategy.connect(owner).permit(owner.address, spender.address, amount, deadline, v, r, s)
		expect(amount.eq(await strategy.allowance(owner.address, spender.address))).to.equal(true)
	})

	it('Should transferFrom tokens', async function () {
		strategy.connect(accounts[1]).transferFrom(accounts[2].address, accounts[1].address, amount)
		expect(BigNumber.from(await strategy.balanceOf(accounts[1].address)).eq(amount)).to.equal(true)
		expect(BigNumber.from(await strategy.balanceOf(accounts[2].address)).eq(0)).to.equal(true)
	})

	it('Should fail to withdraw: no strategy tokens', async function () {
		await expect(strategy.connect(accounts[0]).withdraw(1)).to.be.revertedWith('Amount exceeds balance')
	})

	it('Should fail to withdraw: no amount passed', async function () {
		await expect(strategy.connect(accounts[1]).withdraw(0)).to.be.revertedWith('0 amount')
	})

	it('Should withdraw', async function () {
		amount = BigNumber.from('10000000000000')
		const supplyBefore = BigNumJs((await strategy.totalSupply()).toString())
		const tokenBalanceBefore = BigNumJs((await tokens[1].balanceOf(strategy.address)).toString())
		const tx = await strategy.connect(accounts[1]).withdraw(amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const supplyAfter = BigNumJs((await strategy.totalSupply()).toString())
		const tokenBalanceAfter = BigNumJs((await tokens[1].balanceOf(strategy.address)).toString())
		expect(supplyBefore.minus(amount.toString()).eq(supplyAfter)).to.equal(true)
		expect(
			supplyBefore
				.div(supplyAfter)
				.decimalPlaces(10)
				.isEqualTo(tokenBalanceBefore.div(tokenBalanceAfter).decimalPlaces(10))
		).to.equal(true)
		expect(tokenBalanceBefore.gt(tokenBalanceAfter)).to.equal(true)
	})

	it('Should check valid signature (bytes32)', async function() {
		const message = 'TEST'
		const signature = await accounts[2].signMessage(message) // Manager
		const response = await strategy['isValidSignature(bytes32,bytes)'](ethers.utils.hashMessage(message), signature)
		expect(response).to.equal('0x1626ba7e') //Magic value
	})

	it('Should fail to check invalid signature (bytes32)', async function() {
		const message = 'FAIL'
		const signature = await accounts[1].signMessage(message) //Not manager
		const response = await strategy['isValidSignature(bytes32,bytes)'](ethers.utils.hashMessage(message), signature)
		expect(response).to.equal('0xffffffff') //Invalid value
	})

	it('Should fail to check invalid message (bytes32)', async function() {
		const message = 'FAIL'
		const signature = await accounts[2].signMessage(message) //Mananger
		const response = await strategy['isValidSignature(bytes32,bytes)'](ethers.utils.hashMessage(''), signature) //Bad message
		expect(response).to.equal('0xffffffff') //Invalid value
	})

	it('Should check valid signature (bytes)', async function() {
		const message = 'TEST'
		const signature = await accounts[2].signMessage(message) // Manager
		const response = await strategy['isValidSignature(bytes,bytes)'](ethers.utils.toUtf8Bytes(message), signature)
		expect(response).to.equal('0x20c13b0b') //Magic value
	})

	it('Should fail to check invalid signature (bytes)', async function() {
		const message = 'FAIL'
		const signature = await accounts[1].signMessage(message) //Not manager
		const response = await strategy['isValidSignature(bytes,bytes)'](ethers.utils.toUtf8Bytes(message), signature)
		expect(response).to.equal('0xffffffff') //Invalid value
	})

	it('Should fail to check invalid message (bytes)', async function() {
		const message = 'FAIL'
		const signature = await accounts[2].signMessage(message) //Mananger
		const response = await strategy['isValidSignature(bytes,bytes)']('0x', signature) //Bad message
		expect(response).to.equal('0xffffffff') //Invalid value
	})

	it('Should fail to decrease allowance: more than allowed', async function() {
		await expect(strategy.connect(accounts[1]).decreaseAllowance(accounts[2].address, 1)).to.be.revertedWith('ERC20: decreased allowance below zero')
	})

	it('Should increase allowance', async function() {
		await strategy.connect(accounts[1]).increaseAllowance(accounts[2].address, 1)
		expect((await strategy.allowance(accounts[1].address, accounts[2].address)).eq(1)).to.equal(true)
	})

	it('Should decrease allowance', async function() {
		await strategy.connect(accounts[1]).decreaseAllowance(accounts[2].address, 1)
		expect((await strategy.allowance(accounts[1].address, accounts[2].address)).eq(0)).to.equal(true)
	})
})
