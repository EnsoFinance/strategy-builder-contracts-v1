const hre = require('hardhat')
const deployments = require('../deployments.json')
const { Tokens } = require('../lib/tokens')

const deployedContracts = deployments[process.env.HARDHAT_NETWORK || 'localhost']

async function main() {
  const StrategyProxyFactory = await hre.ethers.getContractFactory('StrategyProxyFactory')
  const factory = await StrategyProxyFactory.attach(deployedContracts['StrategyProxyFactory'])

  const ChainlinkRegistry = await hre.ethers.getContractFactory('ChainlinkRegistry')
  const chainlinkRegistry = await ChainlinkRegistry.attach(deployedContracts['ChainlinkRegistry'])

  const CurveDepositZapRegistry = await hre.ethers.getContractFactory('CurveDepositZapRegistry')
  const curveRegistry = await CurveDepositZapRegistry.attach(deployedContracts['CurveDepositZapRegistry'])

  const accounts = await hre.ethers.getSigners()
  const tokens = new Tokens()
  console.log("Registering tokens...")
  await tokens.registerTokens(accounts[0], factory, curveRegistry, chainlinkRegistry)
  console.log("Tokens registered")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
