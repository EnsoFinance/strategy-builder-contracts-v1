// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const { waitForDeployment, waitForTransaction } = require('./common')
const deployments = require('../deployments.json')
const external = {
  mainnet: {
    weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    susd: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    aaveAddressProvider: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
    curveAddressProvider: '0x0000000022D53366457F9d5E68Ec105046FC4383',
  },
  kovan: {
    weth: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    susd: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
    aaveAddressProvider: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
    curveAddressProvider: '0x0000000022D53366457F9d5E68Ec105046FC4383',
  },
  localhost: {
    weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    susd: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
    uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    aaveAddressProvider: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
    curveAddressProvider: '0x0000000022D53366457F9d5E68Ec105046FC4383',
  },
}

let network, deployedContracts, externalContracts
if (process.env.HARDHAT_NETWORK) {
	network = process.env.HARDHAT_NETWORK
	if (deployments[network]) {
    deployedContracts = deployments[network]
    externalContracts = external[network]
  }
}

//const ADAPTER_NAME = 'CurveLPAdapter'
//const params = [externalContracts.curveAddressProvider, deployedContracts.CurveDepositZapRegistry, externalContracts.weth]

//const ADAPTER_NAME = 'UniswapV3Adapter'
//const params = [deployedContracts.UniswapV3Registry, externalContracts.uniswapV3Router, externalContracts.weth]

const ADAPTER_NAME = 'AaveV2Adapter'
const params = [externalContracts.aaveAddressProvider, deployedContracts.StrategyController, externalContracts.weth]

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

  const Adapter = await hre.ethers.getContractFactory(ADAPTER_NAME)
  const adapter = await waitForDeployment(async (txArgs) => {
    return Adapter.deploy(...params, txArgs)
  }, signer)

  if (owner != signer.address) {
    try {
      const gasCostProviderAddress = await adapter.gasCostProvider()
      if (gasCostProviderAddress && gasCostProviderAddress !== hre.ethers.constants.AddressZero) {
        const GasCostProvider = await hre.ethers.getContractFactory('GasCostProvider')
        const gasCostProvider = GasCostProvider.attach(gasCostProviderAddress)
        await waitForTransaction(async (txArgs) => {
          return gasCostProvider.transferOwnership(owner, txArgs)
        }, signer)
      }
    } catch (e) {
      console.log(e)
    }
  }

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
      return whitelist.connect(ownerAccount).approve(adapter.address, txArgs)
    }, signer)
  }

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
