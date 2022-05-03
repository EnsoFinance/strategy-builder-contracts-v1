import { expect } from 'chai'
import { solidity } from 'ethereum-waffle'
const chai = require('chai')
chai.use(solidity)
import { ethers } from 'hardhat'
import { Contract } from '@ethersproject/contracts'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { deployUniswapV2Adapter } from '../lib/deploy'
import { Tokens } from '../lib/tokens'
import { MAINNET_ADDRESSES } from '../lib/constants'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'

const { constants, getSigners } = ethers
const { WeiPerEther, MaxUint256 } = constants

describe('SushiSwapThroughUniswapV2Adapter', function () {
	let accounts: SignerWithAddress[],
			tokens: Tokens,
			weth: Contract,
			cream: Contract,
			adapter: Contract

	before('Setup SushiSwap, Factory', async function () {
		accounts = await getSigners()
		tokens = new Tokens()
		weth = new Contract(tokens.weth, WETH9.abi, accounts[0])
		cream = new Contract(tokens.cream, ERC20.abi, accounts[0])

		const sushiswapFactory = new Contract(MAINNET_ADDRESSES.SUSHI_FACTORY, [], accounts[0])
		adapter = await deployUniswapV2Adapter(accounts[0], sushiswapFactory, weth)
	})

	it('Should fail to swap: tokens cannot match', async function () {
		await expect(
			adapter.swap(1, 0, weth.address, weth.address, accounts[0].address, accounts[0].address)
		).to.be.revertedWith('Tokens cannot match')
	})

	it('Should fail to swap: less than expected', async function () {
		const amount = WeiPerEther
		await weth.deposit({value: amount})
		await weth.approve(adapter.address, amount)
		await expect(
			adapter.swap(
				amount,
				MaxUint256,
				weth.address,
				cream.address,
				accounts[0].address,
				accounts[0].address
			)
		).to.be.revertedWith('Insufficient tokenOut amount')
	})

	it('Should swap token for token', async function () {
		const amount = WeiPerEther
		// ETH was already deposited for WETH earlier, no need to deposit more
		await weth.approve(adapter.address, amount)
		const wethBalanceBefore = await weth.balanceOf(accounts[0].address)
		const creamBalanceBefore = await cream.balanceOf(accounts[0].address)
		await adapter.swap(amount, 0, weth.address, cream.address, accounts[0].address, accounts[0].address)
		const wethBalanceAfter = await weth.balanceOf(accounts[0].address)
		const creamBalanceAfter = await cream.balanceOf(accounts[0].address)
		expect(wethBalanceBefore.gt(wethBalanceAfter)).to.equal(true)
		expect(creamBalanceBefore.lt(creamBalanceAfter)).to.equal(true)
	})
})
