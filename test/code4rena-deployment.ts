//import hre from 'hardhat'
import chai from 'chai'
//import { Contract } from 'ethers'
//import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { solidity } from 'ethereum-waffle'
//const { ethers } = hre
//const { getContractFactory, getSigners } = ethers
import { deployCode4renaFixes } from '../scripts/code-4rena-deploy'
import { transferOwnershipTokenRegistry } from '../scripts/transferownership-tokenregistry'
import { registerTokens } from '../scripts/register-token'
import { Tokens } from '../lib/tokens'

import { initializeTestLogging, logTestComplete } from '../lib/convincer'

chai.use(solidity)
describe('Code4rena deployment', function () {
	let proofCounter: number,
    contracts: { [key: string]: string },
    tokens: Tokens
	  // accounts: SignerWithAddress[]

	before('Deploy new contracts.', async function () {
		proofCounter = initializeTestLogging(this, __dirname)
	})

	it('Should deployCode4renaFixes', async function () {
    contracts = await deployCode4renaFixes()
    console.log(contracts)
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should transferOwnershipTokenRegistry', async function () {
    await transferOwnershipTokenRegistry()
		logTestComplete(this, __dirname, proofCounter++)
	})

	it('Should registerTokens', async function () {
    tokens = await registerTokens()
    console.log(tokens)
		logTestComplete(this, __dirname, proofCounter++)
	})
})
