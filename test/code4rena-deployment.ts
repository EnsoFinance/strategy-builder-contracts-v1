//import hre from 'hardhat'
import chai from 'chai'
//import { Contract } from 'ethers'
//import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { solidity } from 'ethereum-waffle'
//const { ethers } = hre
//const { getContractFactory, getSigners } = ethers
import { deployCode4renaFixes } from '../scripts/code-4rena-deploy'
require('../scripts/code-4rena-deploy')

import { initializeTestLogging, logTestComplete } from '../lib/convincer'

chai.use(solidity)
describe('Code4rena deployment', function () {
	let proofCounter: number
	//let accounts: SignerWithAddress[], testBinaryTree: Contract

	before('Deploy new contracts.', async function () {
		proofCounter = initializeTestLogging(this, __dirname)
	})

	it('Should deployCode4renaFixes', async function () {
    await deployCode4renaFixes()
		logTestComplete(this, __dirname, proofCounter++)
	})
})
