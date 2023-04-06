const hre = require('hardhat')
const deployedContracts = require('../deployments.json')

async function main() {
  const StrategyController = await hre.ethers.getContractFactory('StrategyController')
  const implementation = await StrategyController.deploy()
  await implementation.deployed()

  console.log('New StrategyController implementation: ', implementation.address)
  const deployer = await hre.ethers.getContractAt(
    'StrategyControllerDeployer',
    deployedContracts[process.env.HARDHAT_NETWORK].StrategyControllerDeployer
  )

  await deployer.upgrade(deployedContracts[process.env.HARDHAT_NETWORK].StrategyController, implementation.address)

  console.log('StrategyController updated')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
