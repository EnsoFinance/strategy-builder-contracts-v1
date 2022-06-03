import chai from 'chai'
const { expect } = chai
import { ethers } from 'hardhat'
const { getContractFactory, getSigners } = ethers
import { solidity } from 'ethereum-waffle'
import { Contract } from 'ethers'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { increaseTime  } from '../lib/utils'

chai.use(solidity)

describe('GasCostProvider', function () {
    let gasCostProvider: Contract,
        owner: SignerWithAddress,
        anybody: SignerWithAddress,
        gasCost: number,
        delay: number

    before('Deploy GasCostProvider', async function () {
        const accounts = await getSigners()
        owner = accounts[0]
        anybody = accounts[1]
        const GasCostProvider = await getContractFactory("GasCostProvider")
        gasCost = 1000
        delay = 69420
        gasCostProvider = await GasCostProvider.deploy(gasCost, owner.address, delay)
        await gasCostProvider.deployed()
    })

    it('Should call updateGasCost', async function () {
        const newGasCost = 10001
        await gasCostProvider.connect(owner).updateGasCost(newGasCost)
    })

    it('Should fail to call updateGasCost', async function () {
        const newGasCost = 10001
        await expect(gasCostProvider.connect(anybody).updateGasCost(newGasCost)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('Should fail to finalizeGasCost', async function () {
        await expect(gasCostProvider.connect(anybody).finalizeGasCost()).to.be.revertedWith('finalizeGasCost: timelock not ready.')
    })

    it('Should finalizeGasCost', async function () {
        await increaseTime(delay)
        await gasCostProvider.connect(anybody).finalizeGasCost()
    })

    it('Should call updateGasCost twice', async function () {
        let newGasCost = 10002
        await gasCostProvider.connect(owner).updateGasCost(newGasCost)
        await increaseTime(delay/2)
        newGasCost = 10003
        await gasCostProvider.connect(owner).updateGasCost(newGasCost)
    })

    it('Should fail to finalizeGasCost', async function () {
        await increaseTime(delay/2)
        await expect(gasCostProvider.connect(anybody).finalizeGasCost()).to.be.revertedWith('finalizeGasCost: timelock not ready.')
    })

    it('Should finalizeGasCost', async function () {
        await increaseTime(delay/2)
        await gasCostProvider.connect(anybody).finalizeGasCost()
    })
})
