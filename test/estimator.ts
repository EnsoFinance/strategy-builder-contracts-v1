import hre from 'hardhat'
import { expect } from 'chai'
import { BigNumber, Contract, Event } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { EnsoBuilder, EnsoEnvironment } from '../lib/enso'
import { Estimator } from '../lib/estimator'
import { Tokens } from '../lib/tokens'
import { prepareStrategy, InitialState } from '../lib/encode'
import { increaseTime } from '../lib/utils'

const { constants, getSigners, getContractFactory } = hre.ethers
const { AddressZero } = constants

const strategyState: InitialState = {
  timelock: BigNumber.from(60),
  rebalanceThreshold: BigNumber.from(10),
  rebalanceSlippage: BigNumber.from(997),
  restructureSlippage: BigNumber.from(985),
  performanceFee: BigNumber.from(0),
  social: false,
  set: false
}

describe('Estimator', function() {
  let accounts: SignerWithAddress[],
      enso: EnsoEnvironment,
      tokens: Tokens,
      estimator: Estimator,
      strategy: Contract,
      routerAddress: string,
      curveAdapterAddress: string,
      synthetixAdapterAddress: string,
      uniswapV2AdapterAddress: string,
      uniswapV3AdapterAddress: string

  before('Setup Enso + Estimator', async function() {
    accounts = await getSigners()
    const owner = accounts[0]

    const ensoBuilder = new EnsoBuilder(owner)
    ensoBuilder.addRouter('full')
    ensoBuilder.addAdapter('aaveLend')
    ensoBuilder.addAdapter('aaveBorrow')
    ensoBuilder.addAdapter('balancer')
    ensoBuilder.addAdapter('curve')
    ensoBuilder.addAdapter('metastrategy')
    ensoBuilder.addAdapter('synthetix')
    ensoBuilder.addAdapter('uniswapV2')
    ensoBuilder.addAdapter('uniswapV3')
    enso = await ensoBuilder.build()

    const { uniswapV3Registry, chainlinkRegistry, curveDepositZapRegistry } = enso.platform.oracles.registries

    tokens = new Tokens()
		await tokens.registerTokens(owner, enso.platform.strategyFactory, uniswapV3Registry, chainlinkRegistry, curveDepositZapRegistry)

    routerAddress = enso.routers[0]?.contract?.address || AddressZero
    curveAdapterAddress = enso.adapters?.curve?.contract?.address || AddressZero
    synthetixAdapterAddress = enso.adapters?.synthetix?.contract?.address || AddressZero
    uniswapV2AdapterAddress = enso.adapters?.uniswapV2?.contract?.address || AddressZero
    uniswapV3AdapterAddress = enso.adapters?.uniswapV3?.contract?.address || AddressZero

    estimator = new Estimator(
      owner,
      enso.platform.oracles.ensoOracle,
      enso.platform.oracles.registries.tokenRegistry,
      enso.platform.oracles.registries.uniswapV3Registry,
      curveAdapterAddress,
      synthetixAdapterAddress,
      uniswapV2AdapterAddress,
      uniswapV3AdapterAddress)

    expect(estimator.oracle.address).equal(enso.platform.oracles.ensoOracle.address)
  })

  it('Should deploy strategy', async function() {
    const name = 'Test Strategy'
		const symbol = 'TEST'
		const positions = [
			{ token: tokens.crv, percentage: BigNumber.from(400) },
			{ token: tokens.sUSD,
        percentage: BigNumber.from(0),
        adapters: [
          uniswapV2AdapterAddress,
          curveAdapterAddress
        ],
        path: [tokens.usdc]
      },
			{ token: tokens.sBTC,
        percentage: BigNumber.from(400),
        adapters: [synthetixAdapterAddress],
        path: []
      },
			{ token: tokens.sEUR,
        percentage: BigNumber.from(200),
        adapters: [synthetixAdapterAddress],
        path: []
      }
		]
		const strategyItems = prepareStrategy(positions, uniswapV3AdapterAddress)

    const depositAmount = BigNumber.from('10000000000000000')
    const estimatedDepositValue = await estimator.create(strategyItems, strategyState.rebalanceThreshold, depositAmount)
    console.log('Estimated deposit value: ', estimatedDepositValue.toString())

		const tx = await enso.platform.strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				name,
				symbol,
				strategyItems,
				strategyState,
				routerAddress,
				'0x',
				{ value: depositAmount }
			)
		const receipt = await tx.wait()
		console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = await Strategy.attach(strategyAddress)

		expect(await enso.platform.controller.initialized(strategy.address)).to.equal(true)

    const [ total ] = await enso.platform.oracles.ensoOracle.estimateStrategy(strategy.address)
    console.log('Actual deposit value: ', total.toString())
  })

  it('Should estimate deposit', async function() {
    await increaseTime(600)
    const [ totalBefore, ] = await enso.platform.oracles.ensoOracle.estimateStrategy(strategy.address)
    const depositAmount = BigNumber.from('10000000000000000')
    const estimatedDepositValue = await estimator.deposit(strategy, depositAmount)
    console.log('Estimated deposit value: ', estimatedDepositValue.toString())
    await enso.platform.controller.connect(accounts[1]).deposit(strategy.address, routerAddress, 0, 0, '0x', { value: depositAmount })
    const [ totalAfter ] = await enso.platform.oracles.ensoOracle.estimateStrategy(strategy.address)
    console.log('Actual deposit value: ', totalAfter.sub(totalBefore).toString())
  })

  it('Should estimate withdraw', async function() {
    const withdrawAmount = await strategy.balanceOf(accounts[1].address)
    const estimatedWithdrawValue = await estimator.withdraw(strategy, withdrawAmount)
    console.log('Estimated withdraw value: ', estimatedWithdrawValue.toString())
  })
})
