import chai from 'chai'
const { expect } = chai
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
const { getContractFactory, getSigners } = ethers
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

chai.use(solidity)

describe('ClonableUpgradeableProxy', function () {
  let test: Contract,
    accounts: SignerWithAddress[]

	before('Deploy test contract', async function () {
		accounts = await getSigners()
    test = await (await getContractFactory("ClonableProxyBenchmarking")).deploy()
    await test.deployed()
	})

	it('Should list gas expenditure', async function () {
    console.log("debug", accounts[0].address)
      let tx = await test.connect(accounts[0]).cloneNaked()
      let receipt = await tx.wait()
      console.log("Gas from cloneNaked", receipt.gasUsed.toString())

      tx = await test.connect(accounts[0]).cloneNakedAndInitialize()
      receipt = await tx.wait()
      console.log("Gas from cloneNakedAndInitialize", receipt.gasUsed.toString())

      await test.callFn() // sanity check
    
      tx = await test.connect(accounts[0]).cloneProxy()
      receipt = await tx.wait()
      console.log("Gas from cloneProxy", receipt.gasUsed.toString())

      tx = await test.connect(accounts[0]).cloneProxyAndInitialize()
      receipt = await tx.wait()
      console.log("Gas from cloneProxyAndInitialize", receipt.gasUsed.toString())

      await test.callFn() // sanity check will revert if not delegated correctly

      expect(true).to.be.true
	})
})
