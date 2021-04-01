const hre = require('hardhat')
const deployedContracts = require('../deployments.json')

async function main() {
  const Strategy = await hre.ethers.getContractFactory('Strategy')
  const implementation = await Strategy.deploy()
  await implementation.deployed()

  console.log('New Strategy implementation: ', implementation.address)
  const factory = await hre.ethers.getContractAt(
    'StrategyProxyFactory',
    deployedContracts[process.env.HARDHAT_NETWORK].StrategyProxyFactory
  )

  await factory.updateImplementation(implementation.address)

  console.log('Strategy updated')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
