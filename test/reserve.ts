import hre from 'hardhat'
import { expect } from 'chai'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { EnsoBuilder, EnsoEnvironment } from '../lib/enso'
import { Tokens } from '../lib/tokens'
import { prepareStrategy, InitialState } from '../lib/encode'
import { ITEM_CATEGORY } from '../lib/utils'

const { constants, getSigners, getContractFactory } = hre.ethers
const { AddressZero, MaxUint256 } = constants

const strategyState: InitialState = {
  timelock: BigNumber.from(60),
  rebalanceThreshold: BigNumber.from(50),
  rebalanceSlippage: BigNumber.from(995),
  restructureSlippage: BigNumber.from(985),
  performanceFee: BigNumber.from(0),
  social: false,
  set: false
}

describe('Reserve', function() {
  let accounts: SignerWithAddress[],
      enso: EnsoEnvironment,
      tokens: Tokens,
      strategy: Contract,
      mockRouter: Contract,
      mockProtocol: Contract,
      mockEstimator: Contract

  before('Setup Enso + Estimator', async function() {
    accounts = await getSigners()
    const owner = accounts[0]

    enso = await (new EnsoBuilder(owner)).build()
    tokens = new Tokens()

    const MockReserveRouter = await getContractFactory('MockReserveRouter')
		mockRouter = await MockReserveRouter.connect(owner).deploy(enso.platform.controller.address)
    const MockProtocol = await getContractFactory('MockProtocol')
    mockProtocol = await MockProtocol.attach(await mockRouter.mockProtocol())
    const MockEstimator = await getContractFactory('MockEstimator')
		mockEstimator = await MockEstimator.connect(owner).deploy(mockProtocol.address)

		await tokens.registerTokens(owner, enso.platform.strategyFactory)
    await enso.platform.strategyFactory.connect(owner).addEstimatorToRegistry(MaxUint256, mockEstimator.address)
    await enso.platform.strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.RESERVE, MaxUint256, mockProtocol.address)
  })

  it('Should deploy reserve strategy', async function() {
    const name = 'Reserve Strategy'
		const symbol = 'RESERVE'
		const positions = [
			{ token: tokens.weth,
        percentage: BigNumber.from(1000),
        adapters: [],
        path: []
      },
			{ token: mockProtocol.address,
        percentage: BigNumber.from(0),
        adapters: [],
        path: []
      }
		]
		const strategyItems = prepareStrategy(positions, AddressZero)

		const tx = await enso.platform.strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				strategyItems,
				strategyState,
				AddressZero,
				'0x'
			)
		const receipt = await tx.wait()
		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		expect(await enso.platform.controller.initialized(strategy.address)).to.equal(true)

    await strategy.connect(accounts[1]).setReserve(mockRouter.address);

    const depositAmount = BigNumber.from('10000000000000000')
    await enso.platform.controller.connect(accounts[1]).deposit(strategy.address, mockRouter.address, 0, 0, '0x', { value: depositAmount })

    const [ total, estimates ] = await enso.platform.oracles.ensoOracle.estimateStrategy(strategy.address)
    console.log('Strategy value: ', total.toString())
    console.log('Reserve value: ', estimates[estimates.length - 1].toString())
  })
})
