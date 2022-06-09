import chai from 'chai'
const { expect } = chai
import { ethers, network } from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { getLiveContracts } from '../lib/mainnet'
import { increaseTime } from '../lib/utils'

const { constants, getSigners, getContractFactory } = ethers
const { MaxUint256, /*WeiPerEther,*/ AddressZero } = constants

async function impersonate(address: string) : Promise<SignerWithAddress> {
    await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [address],
    })
    return await ethers.getSigner(address)
}

describe('Live Upgrades', function () {
	let	accounts: SignerWithAddress[],
		controller: Contract,
    strategyFactory: Contract,
		eDPI: Contract

	before('Setup contracts', async function () {
		accounts = await getSigners()

		const enso = getLiveContracts(accounts[0])
		controller = enso.platform.controller
    strategyFactory = enso.platform.strategyFactory

		const Strategy = await getContractFactory('Strategy')
    // example live strategy
		eDPI = await Strategy.attach('0x890ed1ee6d435a35d51081ded97ff7ce53be5942')

    // update to latest `Strategy`
		const newImplementation = await Strategy.deploy(strategyFactory.address, controller.address, AddressZero, AddressZero)

		await strategyFactory.connect(
      await impersonate(await strategyFactory.owner())
    ).updateImplementation(newImplementation.address, MaxUint256.toString())

    let admin = await strategyFactory.admin();
    const StrategyAdmin = await getContractFactory('StrategyProxyAdmin')
    let strategyAdmin = await StrategyAdmin.attach(admin)
    await strategyAdmin.connect(
      await impersonate(await eDPI.manager())
    ).upgrade(eDPI.address);
	})

	it('Should updateTradeData respecting timelock', async function() {
    // first manager must setup the timelock
    let updateTradeDataSelector = eDPI.interface.getSighash("updateTradeData")
    await eDPI.connect(
        await impersonate(await eDPI.manager())
    ).updateTimelock(updateTradeDataSelector, 5*60);
    await eDPI.connect(accounts[1]).finalizeTimelock()

    // now updateTradeData respecting the timelock
    const items = await eDPI.items()
    const tradeData = await eDPI.getTradeData(items[0])
    expect(tradeData.adapters[0]).to.not.deep.equal(items[0])

    await eDPI.connect(
        await impersonate(await eDPI.manager()) 
    ).updateTradeData(items[0], {
      adapters: [AddressZero], // to test
      path: [],
      cache: '0x'
    })
    // sanity check
    await expect(eDPI.connect(accounts[1]).finalizeUpdateTradeData()).to.be.revertedWith('finalizeUpdateTradeData: timelock not ready.')
    await increaseTime(5*60)
    await eDPI.connect(accounts[1]).finalizeUpdateTradeData()

    const tradeDataAfter = await eDPI.getTradeData(items[0])
    expect(tradeDataAfter.adapters[0]).to.deep.equal(AddressZero)
	})
})
