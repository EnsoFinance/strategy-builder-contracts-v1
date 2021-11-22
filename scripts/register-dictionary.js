// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat');
const { ITEM_CATEGORY, ESTIMATOR_CATEGORY } = require('../lib/utils')
const dictionary = require('../dictionary.json')
const deployments = require('../deployments.json')

const deployedContracts = deployments[process.env.HARDHAT_NETWORK]

const estimators = {
  'synthetix': ESTIMATOR_CATEGORY.SYNTH,
  'compound': ESTIMATOR_CATEGORY.COMPOUND,
  'aave': ESTIMATOR_CATEGORY.AAVE,
  'yearn': ESTIMATOR_CATEGORY.YEARN_V2,
  'curve': ESTIMATOR_CATEGORY.CURVE,
}

async function main() {
  const TokenRegistry = await hre.ethers.getContractFactory('TokenRegistry')
  const registry = await TokenRegistry.attach(deployedContracts.TokenRegistry)
  const Factory = await hre.ethers.getContractFactory('StrategyProxyFactory')
  const factory = await Factory.attach(deployedContracts.StrategyProxyFactory)

  await Promise.all(Object.values(dictionary).map(async (obj) => {
      if (obj.derivedAssets) await Promise.all(obj.derivedAssets.map(async (asset) => {
        const currentCategory = await registry.estimatorCategories(asset.address)
        if (currentCategory.eq(0)) {
          let category = estimators[asset.protocol]
          if (asset.protocol === 'curve' && asset.name.includes('gauge')) {
            category = ESTIMATOR_CATEGORY.CURVE_GAUGE
          }
          console.log(`Adding ${asset.name} to registry...`)
          await factory.addItemToRegistry(ITEM_CATEGORY.BASIC, category, asset.address)
        }
      }))
  }))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
