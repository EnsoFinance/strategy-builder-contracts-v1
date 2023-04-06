import { task } from "hardhat/config";
import { MIGRATE_STRATEGY } from './task-names'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import deploymentsJSON from '../deployments.json'
import deprecatedJSON from '../deprecated.json'

const deployments: { [key: string]: { [key: string]: string } } = deploymentsJSON
const deprecated: { [key: string]: { [key: string]: string } } = deprecatedJSON

const deprecatedVersion = '1.0.10'

task(MIGRATE_STRATEGY, "Migrate a strategy to new contracts")
  .addParam("strategy", "address of strategy")
  .setAction(async (args, hre) => {
    const strategyAddress = args.strategy

    let network: string
    let contracts: { [key: string]: string } = {}
    let deprecatedContracts: { [key: string]: string } = {}
    if (process.env.HARDHAT_NETWORK) {
      network = process.env.HARDHAT_NETWORK
      //ts-ignore
      if (deployments[network]) contracts = deployments[network]
      if (deprecated[deprecatedVersion]) deprecatedContracts = deprecated[deprecatedVersion]
    }

    // NOTE: Cannot be imported via lib/utils since we cannot import hre in tasks
    async function increaseTime(seconds: number) {
    	await hre.network.provider.send('evm_increaseTime', [seconds])
    	return hre.network.provider.send('evm_mine')
    }

    // NOTE: Cannot be imported via lib/utils since we cannot import hre in tasks
    async function impersonate(address: string): Promise<SignerWithAddress> {
    	await hre.network.provider.request({
    		method: 'hardhat_impersonateAccount',
    		params: [address],
    	})
    	return await hre.ethers.getSigner(address)
    }

    async function updateAdapters(
      controller: Contract,
      strategy: Contract,
      manager: SignerWithAddress,
      newAdapters: string[],
      oldAdapters: string[]
    ) {
      const timelock = (await controller.strategyState(strategy.address)).timelock
      const items = await strategy.items()
      for (let i = 0; i < items.length; i++) {
        console.log(`Looking up ${items[i]}...`)
        let tradeData = await strategy.getTradeData(items[i])
        let adapters = [...tradeData.adapters]
        let shouldUpdate = false
        for (let j = 0; j < adapters.length; j++) {
          for (let k = 0; k < oldAdapters.length; k++) {
            if (adapters[j].toLowerCase() == oldAdapters[k].toLowerCase()) {
              adapters[j] = newAdapters[k]
              shouldUpdate = true
            }
          }
        }
        if (shouldUpdate) {
          console.log('Found adapters that need updating!')
          console.log('Old adapters: ', tradeData.adapters)
          console.log('New adapters: ', adapters)
          await controller.connect(manager).updateTradeData(strategy.address, items[i], {
            ...tradeData,
            adapters: adapters,
          })
          await increaseTime(timelock)
          await controller.connect(manager).finalizeTradeData(strategy.address)
        }
      }
    }

    const accounts = await hre.ethers.getSigners()

    const deprecatedAdaptersNames = Object.keys(deprecatedContracts).filter((name) => {
      return name.indexOf('Adapter') > -1
    })
    const newAdapters: string[] = Object.keys(contracts).filter((name) => {
      return deprecatedAdaptersNames.includes(name)
    }).map((name) => {
      return contracts[name]
    })
    const oldAdapters: string[] = deprecatedAdaptersNames.map((name) => {
      return deprecatedContracts[name]
    })

    const controller = await hre.ethers.getContractAt('StrategyController', contracts['StrategyController'], accounts[0])
    const strategyFactory = await hre.ethers.getContractAt('StrategyProxyFactory', contracts['StrategyProxyFactory'], accounts[0])
    const strategy = await hre.ethers.getContractAt('Strategy', strategyAddress, accounts[0])

    const admin = await strategyFactory.admin()
    const strategyAdmin = await hre.ethers.getContractAt('StrategyProxyAdmin', admin, accounts[0])
    // Impersonate manager
    const managerAddress = await strategy.manager()
    const manager = await impersonate(managerAddress)
    // Send funds to manager (just in case!)
    await accounts[19].sendTransaction({ to: managerAddress, value: hre.ethers.constants.WeiPerEther })
    // Upgrade
    console.log('Upgrading strategy...')
    await strategyAdmin.connect(manager).upgrade(strategyAddress)
    console.log('Upgrade complete!')
    console.log('Updating adapters...')
    await updateAdapters(controller, strategy, manager, newAdapters, oldAdapters)
    console.log('Adapters updated!')
    console.log('Updating rewards tokens...')
    await strategy.connect(manager).updateRewards()
    console.log('Rewards updated!')
  })
