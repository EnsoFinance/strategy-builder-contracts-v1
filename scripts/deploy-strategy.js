// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const BigNumber = hre.ethers.BigNumber
const { prepareStrategy } = require('../lib/encode')
const deployments = require('../deployments.json')
const deployedContracts = deployments[process.env.HARDHAT_NETWORK]

const manager = '0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b'
const name = 'Dai Aave Farm'
const symbol = 'DAF'
const positions = [
  {
    token: '0xdCf0aF9e59C002FA3AA091a46196b37530FD48a8',
    percentage: BigNumber.from(1000),
    adapters: [deployedContracts.UniswapV2Adapter, deployedContracts.AaveLendAdapter],
    path: ['0xff795577d9ac8bd7d90ee22b6c1703490b6512fd']
  }
]
const strategyState = {
  timelock: BigNumber.from(60),
  rebalanceThreshold: BigNumber.from(10),
  slippage: BigNumber.from(995),
  performanceFee: BigNumber.from(0),
  social: true,
  set: false
}

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');
  const strategyItems = prepareStrategy(positions, deployedContracts.UniswapV2Adapter)

  const Factory = await hre.ethers.getContractFactory('StrategyProxyFactory')
  const factory = await Factory.attach(deployedContracts.StrategyProxyFactory)
  const tx = await factory.createStrategy(
    manager,
    name,
    symbol,
    strategyItems,
    strategyState,
    deployedContracts.LoopRouter,
    '0x',
    { value: '10000000000000000' }
  )
  await tx.wait()

  console.log('Success')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
