const { expect } = require('chai')
const { ethers } = require('hardhat')
//const { displayBalances } = require('./helpers/logging.js')
const { deployUniswap, deployTokens, deployUniswapAdapter } = require('./helpers/deploy.js')
const { constants, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 2

describe('UniswapAdapter', function () {
	let tokens, accounts, uniswapFactory, adapter, token0Balance, token1Balance

	before('Setup Uniswap, Factory, GenericRouter', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		uniswapFactory = await deployUniswap(accounts[0], tokens)
		adapter = await deployUniswapAdapter(accounts[0], uniswapFactory, tokens[0])
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
		).to.be.revertedWith('tokenIn and tokenOut cannot match')
	})

	it('Should fail to swap: no msg.value for token swap', async function () {
		await expect(
			adapter.swap(
				1,
				0,
				tokens[0].address,
				tokens[1].address,
				accounts[0].address,
				accounts[0].address,
				'0x',
				'0x',
				{ value: 1 }
			)
		).to.be.revertedWith('Cannot send value if tokenIn is not Ether')
	})

	it('Should fail to swap: insufficent received', async function () {
		await expect(
			adapter.swap(
				10,
				1000,
				AddressZero,
				tokens[1].address,
				accounts[0].address,
				accounts[0].address,
				'0x',
				'0x',
				{ value: 10 }
			)
		).to.be.revertedWith('Insufficient tokenOut amount')
	})

	it('Should swap eth for token', async function () {
		await adapter.swap(
			100000,
			0,
			AddressZero,
			tokens[1].address,
			accounts[0].address,
			accounts[0].address,
			'0x',
			'0x',
			{ value: 100000 }
		)
		token1Balance = await tokens[1].balanceOf(accounts[0].address)
		expect(token1Balance.gt(0)).to.equal(true)
	})

	it('Should swap token for token', async function () {
		await adapter.swap(
			token1Balance,
			0,
			tokens[1].address,
			tokens[0].address,
			accounts[0].address,
			accounts[0].address,
			'0x',
			'0x'
		)
		token0Balance = await tokens[0].balanceOf(accounts[0].address)
		token1Balance = await tokens[1].balanceOf(accounts[0].address)
		expect(token0Balance.gt(0)).to.equal(true)
		expect(token1Balance.eq(0)).to.equal(true)
	})
})
