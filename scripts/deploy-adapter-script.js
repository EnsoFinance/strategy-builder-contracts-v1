// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const deployments = require('../deployments.json')
const external = {
  mainnet: {
    weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    susd: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51'
  },
  kovan: {
    weth: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    susd: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51'
  },
}
const deployedContracts = deployments[process.env.HARDHAT_NETWORK]
const externalContracts = external[process.env.HARDHAT_NETWORK]

const ADAPTER_NAME = 'CurveRewardsAdapter'
const params = [deployedContracts.CurvePoolRegistry, externalContracts.weth]

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');
  const Adapter = await hre.ethers.getContractFactory(ADAPTER_NAME)
  const adapter = await Adapter.deploy(...params)
  await adapter.deployed()

  const Whitelist = await hre.ethers.getContractFactory('Whitelist')
  const whitelist = await Whitelist.attach(deployedContracts['Whitelist'])
  const tx = await whitelist.approve(adapter.address)
  await tx.wait()

  console.log(`${ADAPTER_NAME}: `, adapter.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
