import hre from 'hardhat'
const { ethers } = hre
const { getContractAt, getSigners } = ethers
import deploymentsJSON from '../deployments.json'
import deprecatedJSON from '../deprecated.json'
import { impersonate } from '../lib/utils'

const deployments: { [key: string]: { [key: string]: string } } = deploymentsJSON
const deprecated: { [key: string]: { [key: string]: string } } = deprecatedJSON

const deprecatedVersion = '1.0.10'

let network: string
let contracts: { [key: string]: string } = {}
let deprecatedContracts: { [key: string]: string } = {}
if (process.env.HARDHAT_NETWORK) {
  network = process.env.HARDHAT_NETWORK
  //ts-ignore
  if (deployments[network]) contracts = deployments[network]
  if (deprecated[deprecatedVersion]) deprecatedContracts = deprecated[deprecatedVersion]
}

async function main(): Promise<void> {
  const accounts = await getSigners()

  // whitelist new adapters and router
  const whitelist = await getContractAt('Whitelist', contracts['Whitelist'], accounts[0])
  const multisig = await impersonate(await whitelist.callStatic.owner())

  const deprecatedAdaptersNames = Object.keys(deprecatedContracts).filter((name) => {
    return name.indexOf('Adapter') > -1
  })
  const newAdapters: string[] = Object.keys(contracts).filter((name) => {
    return deprecatedAdaptersNames.includes(name)
  }).map((name) => {
    return contracts[name]
  })

  let toWhitelist: string[] = [ ...newAdapters ]
  toWhitelist.push(contracts['LoopRouter'])
  toWhitelist.push(contracts['FullRouter'])
  toWhitelist.push(contracts['MulticallRouter'])

  for (let i = 0; i < toWhitelist.length; ++i) {
    if (!(await whitelist.callStatic.approved(toWhitelist[i])))
      await whitelist.connect(multisig).approve(toWhitelist[i])
  }
  console.log('approved adapters', newAdapters)
  console.log('approved routers', contracts['LoopRouter'], contracts['FullRouter'], contracts['MulticallRouter'])

  const platformProxyAdmin = await getContractAt('PlatformProxyAdmin', contracts['PlatformProxyAdmin'], accounts[0])
  await platformProxyAdmin
    .connect(multisig)
    .upgrade(contracts['StrategyController'], contracts['StrategyControllerImplementation'])

  await platformProxyAdmin
    .connect(multisig)
    .upgrade(contracts['StrategyProxyFactory'], contracts['StrategyProxyFactoryImplementation'])

  console.log('platformProxyAdmin upgrades StrategyController and StrategyProxyFactory')

  const strategyFactory = await getContractAt('StrategyProxyFactory', contracts['StrategyProxyFactory'], accounts[0])
  await strategyFactory.connect(multisig).updateOracle(contracts['EnsoOracle'])
  await strategyFactory.connect(multisig).updateRegistry(contracts['TokenRegistry'])
  await strategyFactory
    .connect(multisig)
    .updateImplementation(
      contracts['StrategyImplementation'],
      ((await strategyFactory.callStatic.version()) + 1).toString()
    )
  console.log('strategyFactory updates oracle and tokenRegistry')
  const controller = await getContractAt('StrategyController', contracts['StrategyController'], accounts[0])
  await controller.connect(accounts[3]).updateAddresses() // anyone
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
