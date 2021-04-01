const hre = require('hardhat')
const deployedContracts = require('../deployments.json')

const externalContracts = {
  mainnet: {
    weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    uniswapFactory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  },
  kovan: {
    weth: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    uniswapFactory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  },
}

async function main() {
  const Oracle = await hre.ethers.getContractFactory('UniswapNaiveOracle')
  const oracle = await Oracle.deploy(
    externalContracts[process.env.HARDHAT_NETWORK].uniswapFactory,
    externalContracts[process.env.HARDHAT_NETWORK].weth
  )
  await oracle.deployed()

  console.log('Oracle: ', oracle.address)
  const factory = await hre.ethers.getContractAt(
    'StrategyProxyFactory',
    deployedContracts[process.env.HARDHAT_NETWORK].StrategyProxyFactory
  )

  await factory.updateOracle(oracle.address)

  console.log('Oracle updated')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
