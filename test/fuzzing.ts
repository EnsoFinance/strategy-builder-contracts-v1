import hre from 'hardhat'
import chai from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { solidity } from 'ethereum-waffle'
const { ethers } = hre
const { getContractFactory, getSigners } = ethers
import { initializeTestLogging, logTestComplete } from '../lib/convincer'

chai.use(solidity)
describe('Fuzzing Libraries', function () {
	let proofCounter: number
	let accounts: SignerWithAddress[], testBinaryTree: Contract

	before('Setup signers etc.', async function () {
		proofCounter = initializeTestLogging(this, __dirname)
		accounts = await getSigners()
		const TestBinaryTree = await getContractFactory('TestBinaryTree')
		testBinaryTree = await TestBinaryTree.deploy()
		await testBinaryTree.deployed()
	})

	it('Should fuzz AddressArray.readInto', async function () {
		const tx = await testBinaryTree.connect(accounts[0]).fuzzAddressArrayReadInto()
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should fuzz BinaryTreeWithPayload.readInto', async function () {
		const tx = await testBinaryTree.connect(accounts[0]).fuzzBinaryTreeWithPayloadReadInto()
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		logTestComplete(this, __dirname, proofCounter++)
	})
})
