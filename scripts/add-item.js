// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const { ITEM_CATEGORY, ESTIMATOR_CATEGORY } = require('../lib/constants')
const deployments = require('../deployments.json')
const deployedContracts = deployments[process.env.HARDHAT_NETWORK]

const ITEM = ITEM_CATEGORY.BASIC
const ESTIMATOR = ESTIMATOR_CATEGORY.AAVE_V2
const TOKEN = '0xdCf0aF9e59C002FA3AA091a46196b37530FD48a8'

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');
  const Factory = await hre.ethers.getContractFactory('StrategyProxyFactory')
  const factory = await Factory.attach(deployedContracts['StrategyProxyFactory'])
  const tx = await factory.addItemToRegistry(ITEM, ESTIMATOR, TOKEN)
  await tx.wait()

  console.log('Success')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
