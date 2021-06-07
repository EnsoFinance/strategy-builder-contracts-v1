const hre = require('hardhat')
const { ethers } = hre
// const { getContractFactory } = waffle
const { getSigners} = ethers
const { EnsoBuilder, EnsoEnvironment } = require('@enso/contracts')
import * as utils from '@enso/contracts/lib/utils'
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
		mainnetForkEnso = await new EnsoBuilder(accounts[1]).build()
		localTestnetEnso = await new EnsoBuilder(accounts[1]).testnet().build()
	})
	it('deploy platform with defaults', async () => {
		expect(mainnetForkEnso.uniswap.address.toLowerCase()).to.eq(utils.MAINNET_ADDRESSES.UNISWAP.toLowerCase())
	})
	it('deploy platform with testnet defaults', async () => {
		expect(localTestnetEnso.uniswap.address.toLowerCase()).to.not.eq(utils.MAINNET_ADDRESSES.UNISWAP.toLowerCase())
	})

	// it('deploy strategy onto default forked mainnet environment', async () => {
		// const name = 'Test Strategy'
		// const symbol = 'TEST'
		// const positions = [
		// 	{ token: localTestnetEnso.tokens[1].address, percentage: BigNumber.from(200) },
		// 	{ token: localTestnetEnso.tokens[2].address, percentage: BigNumber.from(200) },
		// 	{ token: localTestnetEnso.tokens[3].address, percentage: BigNumber.from(50) },
		// 	{ token: localTestnetEnso.tokens[4].address, percentage: BigNumber.from(50) },
		// 	{ token: localTestnetEnso.tokens[5].address, percentage: BigNumber.from(50) },
		// 	{ token: localTestnetEnso.tokens[6].address, percentage: BigNumber.from(50) },
		// 	{ token: localTestnetEnso.tokens[7].address, percentage: BigNumber.from(50) },
		// 	{ token: localTestnetEnso.tokens[8].address, percentage: BigNumber.from(50) },
		// 	{ token: localTestnetEnso.tokens[9].address, percentage: BigNumber.from(50) },
		// 	{ token: localTestnetEnso.tokens[10].address, percentage: BigNumber.from(50) },
		// 	{ token: localTestnetEnso.tokens[11].address, percentage: BigNumber.from(50) },
		// 	{ token: localTestnetEnso.tokens[12].address, percentage: BigNumber.from(50) },
		// 	{ token: localTestnetEnso.tokens[13].address, percentage: BigNumber.from(50) },
		// ]
	// 	const adapters = localTestnetEnso.adapters.map((a: Contract) => a.address)
	// 	const strategyConfig = new StrategyBuilder(positions, adapters)
	// 	const data = ethers.utils.defaultAbiCoder.encode(
	// 		['address[]', 'address[]'],
	// 		[strategyConfig.tokens, strategyConfig.adapters]
	// 	)
	// 	const tx = await localTestnetEnso.enso.strategyFactory
	// 		.connect(accounts[1])
	// 		.createStrategy(
	// 			accounts[1].address,
	// 			name,
	// 			symbol,
	// 			strategyConfig.tokens,
	// 			strategyConfig.percentages,
	// 			false,
	// 			0,
	// 			localTestnetEnso.defaults.REBALANCE_THRESHOLD,
	// 			localTestnetEnso.defaults.SLIPPAGE,
	// 			localTestnetEnso.defaults.TIMELOCK,
	// 			localTestnetEnso.routers[0].address,
	// 			data,
	// 			{ value: ethers.BigNumber.from('10000000000000000') }
	// 		)
	// 	const receipt = await tx.wait()
	// 	console.log('Deployment Gas Used: ', receipt.gasUsed.toString())
	// 	const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
	// 	// const Strategy = await getContractFactory('Strategy')
	// 	// const strategy = await Strategy.attach(strategyAddress)
	// 	const LibraryWrapper = await getContractFactory('LibraryWrapper')
	// 	const wrapper = await LibraryWrapper.connect(accounts[0]).deploy(
	// 		localTestnetEnso.oracle.address,
	// 		strategyAddress
	// 	)
	// 	await wrapper.deployed()
	// 	//await displayBalances(wrapper, strategyTokens, WETH)
	// 	expect(await wrapper.isBalanced()).to.equal(true)
	// })
})
