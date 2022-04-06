import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { Tokens } from '../lib/tokens'
import { MAINNET_ADDRESSES } from '../lib/constants'

const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants


let accounts: SignerWithAddress[],
		owner: SignerWithAddress,
		oracle: Contract,
		registry: Contract,
		tokens: Tokens


describe('ChainlinkOracle', function() {
	before('Setup Oracle', async function() {
		accounts = await getSigners()
		owner = accounts[0]

		const Registry = await getContractFactory('ChainlinkRegistry')
		registry = await Registry.connect(owner).deploy()

		const Oracle = await getContractFactory('ChainlinkOracle')
		oracle = await Oracle.connect(owner).deploy(registry.address, MAINNET_ADDRESSES.WETH)
		await oracle.deployed()

		tokens = new Tokens()
	})

	it('Should fail to add pairs: not owner', async function() {
		// Add chainlink oracle
		await expect(
			registry.connect(accounts[1]).batchAddOracles(
				[tokens.sUSD, tokens.sEUR, tokens.sLINK],
				[MAINNET_ADDRESSES.WETH, tokens.sUSD, MAINNET_ADDRESSES.WETH],
				['0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', '0xb49f677943BC038e9857d61E7d053CaA2C1734C1', '0xDC530D9457755926550b59e8ECcdaE7624181557'],
				[true, false, false]
			)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it('Should add pairs', async function() {
		// Add chainlink oracle
		await registry.connect(owner).batchAddOracles(
			[tokens.sUSD, tokens.sEUR, tokens.sLINK],
			[MAINNET_ADDRESSES.WETH, tokens.sUSD, MAINNET_ADDRESSES.WETH],
			['0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', '0xb49f677943BC038e9857d61E7d053CaA2C1734C1', '0xDC530D9457755926550b59e8ECcdaE7624181557'],
			[true, false, false]
		)
	})

	it('Should fail to remove pair: not owner', async function() {
		await expect(
			registry.connect(accounts[1]).removeOracle(tokens.sLINK)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it('Should remove pair', async function() {
		await registry.connect(owner).removeOracle(tokens.sLINK);
	})

	it('Should fail to add single pair: not owner', async function() {
		await expect(
			registry.connect(accounts[1]).addOracle(tokens.sLINK, MAINNET_ADDRESSES.WETH, '0xDC530D9457755926550b59e8ECcdaE7624181557', false)
		).to.be.revertedWith("Ownable: caller is not the owner")
	})

	it('Should add single pair', async function() {
		await registry.connect(owner).addOracle(tokens.sLINK, MAINNET_ADDRESSES.WETH, '0xDC530D9457755926550b59e8ECcdaE7624181557', false);
	})

	it('Should consult oracle: weth', async function() {
		const amount = WeiPerEther
		expect((await oracle.consult(amount, MAINNET_ADDRESSES.WETH)).eq(amount)).to.equal(true)
	})

	it('Should consult oracle: no amount', async function() {
		const amount = 0
		expect((await oracle.consult(amount, AddressZero)).eq(amount)).to.equal(true)
	})

	it('Should consult oracle: sEUR', async function() {
		const price = await oracle.consult(WeiPerEther, tokens.sEUR)
		console.log("Price: ", price.toString());
	})

	it('Should consult oracle: sUSD', async function() {
		const price = await oracle.consult(WeiPerEther, tokens.sUSD)
		console.log("Price: ", price.toString());
	})

	it('Should consult oracle: sLINK', async function() {
		const price = await oracle.consult(WeiPerEther, tokens.sLINK)
		console.log("Price: ", price.toString());
	})
})
