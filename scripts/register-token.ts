const hre = require('hardhat')
const deployments = require('../deployments.json')
const { Tokens } = require('../lib/tokens')
//import { impersonate } from '../lib/utils'

const deployedContracts = deployments[process.env.HARDHAT_NETWORK || 'localhost']

let network: string
if (process.env.HARDHAT_NETWORK) {
	network = process.env.HARDHAT_NETWORK
}

async function main() {
  const StrategyProxyFactory = await hre.ethers.getContractFactory('StrategyProxyFactory')
  const factory = await StrategyProxyFactory.attach(deployedContracts['StrategyProxyFactory'])

  const ChainlinkRegistry = await hre.ethers.getContractFactory('ChainlinkRegistry')
  const chainlinkRegistry = await ChainlinkRegistry.attach(deployedContracts['ChainlinkRegistry'])

  const CurveDepositZapRegistry = await hre.ethers.getContractFactory('CurveDepositZapRegistry')
  const curveRegistry = await CurveDepositZapRegistry.attach(deployedContracts['CurveDepositZapRegistry'])
  const tokens = new Tokens()
  console.log("Registering tokens...")
	const [signer] = await hre.ethers.getSigners()
  const owner = network == 'mainnet' ? '0xca702d224D61ae6980c8c7d4D98042E22b40FFdB' : signer.address //smart contract upgrades multisig
  console.log('Owner: ', owner)
	//let [signer] = await hre.ethers.getSigners()
	//signer = network == 'mainnet' ? signer : await impersonate('0xca702d224D61ae6980c8c7d4D98042E22b40FFdB') //smart contract upgrades multisig
	console.log('Owner: ', signer.address)
  console.log(await factory.owner())
  console.log(await chainlinkRegistry.owner())
  await tokens.registerTokens(signer, factory, undefined, chainlinkRegistry, curveRegistry)
  console.log("Tokens registered")
  return tokens
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
