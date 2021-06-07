// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')

const deployedContracts = {
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
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  const Oracle = await hre.ethers.getContractFactory('UniswapNaiveOracle')
  const oracle = await Oracle.deploy(
    deployedContracts[process.env.HARDHAT_NETWORK].uniswapFactory,
    deployedContracts[process.env.HARDHAT_NETWORK].weth
  )
  await oracle.deployed()

  console.log('Oracle deployed to: ', oracle.address)

  const Whitelist = await hre.ethers.getContractFactory('Whitelist')
  const whitelist = await Whitelist.deploy()
  await whitelist.deployed()

  console.log('Whitelist deployed to: ', whitelist.address)

  const Strategy = await hre.ethers.getContractFactory('Strategy')
  const strategyImplementation = await Strategy.deploy()
  await strategyImplementation.deployed()

  const StrategyProxyFactoryAdmin = await hre.ethers.getContractFactory('StrategyProxyFactoryAdmin')
  const factoryAdmin = await StrategyProxyFactoryAdmin.deploy(
    strategyImplementation.address,
    oracle.address,
    whitelist.address
  )
  await factoryAdmin.deployed()

  console.log('StrategyProxyFactoryAdmin deployed to:', factoryAdmin.address)

  const factoryAddress = await factoryAdmin.factory()

  console.log('StrategyProxyFactory deployed to:', factoryAddress)

  const StrategyControllerAdmin = await hre.ethers.getContractFactory('StrategyControllerAdmin')
  const deployer = await StrategyControllerAdmin.deploy(factoryAddress)
  await deployer.deployed()

  console.log('StrategyControllerAdmin deployed to: ', deployer.address)

  const controllerAddress = await deployer.controller()

  console.log('StrategyController deployed to: ', controllerAddress)

  const StrategyProxyFactory = await hre.ethers.getContractFactory('StrategyProxyFactory')
  const strategyFactory = await StrategyProxyFactory.attach(factoryAddress)
  await strategyFactory.setController(controllerAddress)

  const UniswapAdapter = await hre.ethers.getContractFactory('UniswapV2Adapter')
  const uniswapAdapter = await UniswapAdapter.deploy(
    deployedContracts[process.env.HARDHAT_NETWORK].uniswapFactory,
    deployedContracts[process.env.HARDHAT_NETWORK].weth
  )
  await uniswapAdapter.deployed()

  console.log('UniswapV2Adapter deployed to: ', uniswapAdapter.address)

  const LoopRouter = await hre.ethers.getContractFactory('LoopRouter')
  const loopRouter = await LoopRouter.deploy(
    uniswapAdapter.address,
    controllerAddress,
    deployedContracts[process.env.HARDHAT_NETWORK].weth
  )
  await loopRouter.deployed()

  console.log('LoopRouter deployed to: ', loopRouter.address)

  let tx = await whitelist.approve(loopRouter.address)
  await tx.wait()

  const GenericRouter = await hre.ethers.getContractFactory('GenericRouter')
  const genericRouter = await GenericRouter.deploy(
    controllerAddress,
    deployedContracts[process.env.HARDHAT_NETWORK].weth
  )
  await genericRouter.deployed()

  console.log('GenericRouter deployed to: ', genericRouter.address)

  tx = await whitelist.approve(genericRouter.address)
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
