import hre from 'hardhat'
import chai from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { solidity } from 'ethereum-waffle'
const { ethers } = hre
const { getContractFactory, getSigners } = ethers

chai.use(solidity)
describe('Fuzzing Libraries', function () {
	let accounts: SignerWithAddress[], testBinaryTree: Contract

	before('Setup signers etc.', async function () {
		const _config: any = hre.network.config
		await hre.network.provider.request({
			method: 'hardhat_reset',
			params: [
				{
					forking: {
						jsonRpcUrl: _config.forking.url,
						blockNuber: _config.forking.blockNumber,
					},
				},
			],
		})

		accounts = await getSigners()
		const TestBinaryTree = await getContractFactory('TestBinaryTree')
		testBinaryTree = await TestBinaryTree.deploy()
		await testBinaryTree.deployed()
	})

	it('Should fuzz AddressArray.readInto', async function () {
		const tx = await testBinaryTree.connect(accounts[0]).fuzzAddressArrayReadInto()
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
	})

	it('Should fuzz BinaryTreeWithPayload.readInto', async function () {
		const tx = await testBinaryTree.connect(accounts[0]).fuzzBinaryTreeWithPayloadReadInto()
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
	})
})
