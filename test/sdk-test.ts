const hre = require('hardhat')
const { ethers } = hre
// const { getContractFactory } = waffle
const { getSigners} = ethers
const { EnsoBuilder, EnsoEnvironment } = require('../lib/index')
import * as utils from '../lib/utils'
// import { StrategyBuilder } from '@enso/contracts/lib/encode'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
// import { Contract, Event } from '@ethersproject/contracts'

describe('SDK', function () {
	let accounts: SignerWithAddress[]
	let mainnetForkEnso: typeof EnsoEnvironment
	let localTestnetEnso: typeof EnsoEnvironment
	before('minimal mainnet-fork setup', async function () {
		accounts = await getSigners()
	})
	it('deploy platform with defaults', async () => {
		mainnetForkEnso = await new EnsoBuilder(accounts[1]).build()
		expect(mainnetForkEnso.uniswap.address.toLowerCase()).to.eq(utils.MAINNET_ADDRESSES.UNISWAP.toLowerCase())
	})
	it('deploy platform with testnet defaults', async () => {
		localTestnetEnso = await new EnsoBuilder(accounts[1]).testnet().build()
		expect(localTestnetEnso.uniswap.address.toLowerCase()).to.not.eq(utils.MAINNET_ADDRESSES.UNISWAP.toLowerCase())
	})
	it('deploy platform with leverage adapter', async () => {
		const builder = new EnsoBuilder(accounts[1])
		builder.addAdapter('leverage')
		mainnetForkEnso = await builder.build()
		expect(mainnetForkEnso.adapters.aavelend.contract).to.not.eq(undefined)
		expect(mainnetForkEnso.adapters.aaveborrow.contract).to.not.eq(undefined)
		expect(mainnetForkEnso.adapters.leverage.contract).to.not.eq(undefined)
	})
})
