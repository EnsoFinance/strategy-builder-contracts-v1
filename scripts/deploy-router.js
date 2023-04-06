// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const { waitForDeployment, waitForTransaction } = require('./common')
const deployments = require('../deployments.json')

let network, deployedContracts
if (process.env.HARDHAT_NETWORK) {
	network = process.env.HARDHAT_NETWORK
	if (deployments[network]) {
    deployedContracts = deployments[network]
  }
}

const ROUTER_NAME = 'LoopRouter'

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');
  const [ signer ] = await hre.ethers.getSigners()
	const owner = network == 'mainnet' ? '0xca702d224D61ae6980c8c7d4D98042E22b40FFdB' : signer.address; //smart contract upgrades multisig
	console.log("Owner: ", owner)

  const libraryAddress = deployedContracts['StrategyLibrary']

  let Router;
  if (ROUTER_NAME == 'MulticallRouter') {
    Router = await hre.ethers.getContractFactory(ROUTER_NAME)
  } else {
    Router = await hre.ethers.getContractFactory(ROUTER_NAME, {
      libraries: {
        StrategyLibrary: libraryAddress,
      }
    })
  }
	const router = await waitForDeployment(async (txArgs) => {
    return  Router.deploy(deployedContracts['StrategyController'], txArgs)
  }, signer)

  const Whitelist = await hre.ethers.getContractFactory('Whitelist')
  const whitelist = await Whitelist.attach(deployedContracts['Whitelist'])

  const whitelistOwner = await whitelist.owner()

  let ownerAccount
  if (whitelistOwner != signer.address) {
    if (network == 'localhost') {
      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [whitelistOwner],
      });
      ownerAccount = await hre.ethers.getSigner(whitelistOwner);
    }
		// TODO: If mainnet, attempt to trigger a transaction on multisig
  } else {
    ownerAccount = signer
  }

  if (ownerAccount) {
    console.log("Whitelist owner: ", ownerAccount.address)
		await waitForTransaction(async (txArgs) => {
      return whitelist.connect(ownerAccount).approve(router.address, txArgs)
    }, signer)
  }

  console.log(`${ROUTER_NAME}: `, router.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
