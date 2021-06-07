import { expect } from 'chai'
import { solidity } from 'ethereum-waffle'
const chai = require('chai')
chai.use(solidity)


import { ethers } from 'hardhat'
import { Contract } from '@ethersproject/contracts'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { deployUniswapV2, deployTokens, deployUniswapV2Adapter } from '../lib/deploy'
const { constants, getSigners } = ethers
const { WeiPerEther } = constants

const NUM_TOKENS = 2

describe('UniswapAdapter', function () {
	let tokens: Contract[], accounts: SignerWithAddress[], uniswapFactory: Contract, adapter: Contract

	before('Setup Uniswap, Factory, GenericRouter', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		uniswapFactory = await deployUniswapV2(accounts[0], tokens)
		adapter = await deployUniswapV2Adapter(accounts[0], uniswapFactory, tokens[0])
		tokens.forEach(async (token) => {
			await token.approve(adapter.address, constants.MaxUint256)
		})
	})

	it('Should fail to swap: tokens cannot match', async function () {
		await expect(
			adapter.swap(
				1,
				0,
				tokens[0].address,
				tokens[0].address,
				accounts[0].address,
				accounts[0].address,
				'0x',
				'0x'
			)
		).to.be.revertedWith('Tokens cannot match')
	})

	it('Should fail to swap: less than expected', async function () {
		const amount = WeiPerEther
		const expected = ethers.BigNumber.from(
			await adapter.swapPrice(amount, tokens[1].address, tokens[0].address)
		).add(1)
		await tokens[1].approve(adapter.address, amount)
		await expect(
			adapter.swap(
				amount,
				expected,
				tokens[1].address,
				tokens[0].address,
				accounts[0].address,
				accounts[0].address,
				'0x',
				'0x'
			)
		).to.be.revertedWith('Insufficient tokenOut amount')
	})

	it('Should swap token for token', async function () {
		const amount = WeiPerEther
		await tokens[1].approve(adapter.address, amount)
		const token0BalanceBefore = await tokens[0].balanceOf(accounts[0].address)
		const token1BalanceBefore = await tokens[1].balanceOf(accounts[0].address)
		await adapter.swap(
			amount,
			0,
			tokens[1].address,
			tokens[0].address,
			accounts[0].address,
			accounts[0].address,
			'0x',
			'0x'
		)
		const token0BalanceAfter = await tokens[0].balanceOf(accounts[0].address)
		const token1BalanceAfter = await tokens[1].balanceOf(accounts[0].address)
		expect(token0BalanceBefore.lt(token0BalanceAfter)).to.equal(true)
		expect(token1BalanceBefore.gt(token1BalanceAfter)).to.equal(true)
	})
})
