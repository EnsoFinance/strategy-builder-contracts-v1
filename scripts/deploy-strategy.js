// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const BigNumber = hre.ethers.BigNumber
const { prepareStrategy } = require('../lib/encode')
const { Tokens } = require('../lib/tokens')
const deployments = require('../deployments.json')

const deployedContracts = deployments[process.env.HARDHAT_NETWORK]
const tokens = new Tokens()

const manager = '0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b'
const name = 'Test'
const symbol = 'TEST'
const positions = [
  {
    token: tokens.crvLINK,
    percentage: BigNumber.from(1000),
    adapters: [deployedContracts.UniswapV2Adapter, deployedContracts.CurveLPAdapter],
    path: [tokens.link]
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
    { value: '1000000000000000000' }
  )
  const receipt = await tx.wait()
  const strategyAddress = receipt.events.find((ev) => ev.event === 'NewStrategy').args.strategy
  console.log('Strategy address: ', strategyAddress)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
