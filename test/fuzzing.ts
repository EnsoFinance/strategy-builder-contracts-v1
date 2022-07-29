import hre from 'hardhat'
import chai from 'chai'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { solidity } from 'ethereum-waffle'
const { ethers } = hre
const { getContractFactory, getSigners } = ethers
//const { TransparentUpgradeableProxy } = require('../artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json')


chai.use(solidity)
describe('Fuzzing Libraries', function () {
	let accounts: SignerWithAddress[], testBinaryTree: Contract

	before('Setup signers etc.', async function () {
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

	it('Should test storage', async function () {
      const testStorage = await (await getContractFactory("TestStorage")).deploy()
      await testStorage.deployed()

      const tup = await (await getContractFactory("TransparentUpgradeableProxy")).deploy(testStorage.address, accounts[0].address, '0x')
      await tup.deployed()
      const ProxyHarness = await ethers.getContractFactory("ProxyHarness")
      const proxyHarness = await ProxyHarness.connect(accounts[0]).deploy(tup.address)
      await proxyHarness.deployed()

      await proxyHarness.connect(accounts[0]).test()
      
      const testStorageUpgrade = await (await getContractFactory("TestStorageUpgrade")).deploy()
      await testStorageUpgrade.deployed()

      await tup.connect(accounts[0]).upgradeTo(testStorageUpgrade.address)

      
      await proxyHarness.connect(accounts[0]).test()
	})
})
