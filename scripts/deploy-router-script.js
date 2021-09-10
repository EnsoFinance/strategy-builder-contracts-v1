// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const deployments = require('../deployments.json')

const ROUTER_NAME = 'BatchDepositRouter'
const deployedContracts = deployments[process.env.HARDHAT_NETWORK]

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');



  const Router = await hre.ethers.getContractFactory(ROUTER_NAME)
  const router = await Router.deploy(
    deployedContracts['StrategyController']
  )
  await router.deployed()
  console.log(`${ROUTER_NAME}: `, router.address)

  const Whitelist = await hre.ethers.getContractFactory('Whitelist')
  const whitelist = await Whitelist.attach(deployedContracts['Whitelist'])
  const tx = await whitelist.approve(router.address)
  await tx.wait()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
