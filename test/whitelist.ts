const { expect } = require('chai')
const { ethers } = require('hardhat')
const { getContractFactory, getSigners } = ethers
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

describe('Whitelist', function() {
	let accounts: SignerWithAddress[], whitelist: Contract

	before('Deploy Whitelist', async function() {
    accounts = await getSigners()
    const Whitelist = await getContractFactory('Whitelist')
    whitelist = await Whitelist.connect(accounts[0]).deploy()
    await whitelist.deployed()
	})

	it('Should add to whitelist', async function() {
    await whitelist.approve(accounts[1].address)
    expect(await whitelist.approved(accounts[1].address)).to.equal(true)
	})

  it('Should fail to add to whitelist: already approved', async function() {
    await expect(whitelist.approve(accounts[1].address)).to.be.revertedWith('Already whitelisted')
  })

  it('Should fail to add to whitelist: not owner', async function() {
    await expect(whitelist.connect(accounts[2]).approve(accounts[2].address)).to.be.revertedWith('Ownable: caller is not the owner')
	})

  it('Should fail to remove from whitelist: not owner', async function() {
    await expect(whitelist.connect(accounts[2]).approve(accounts[1].address)).to.be.revertedWith('Ownable: caller is not the owner')
	})

  it('Should remove from whitelist', async function() {
    await whitelist.revoke(accounts[1].address)
    expect(await whitelist.approved(accounts[1].address)).to.equal(false)
	})

  it('Should fail to remove from whitelist: not approved', async function() {
    await expect(whitelist.revoke(accounts[2].address)).to.be.revertedWith('Not whitelisted')
  })
})
