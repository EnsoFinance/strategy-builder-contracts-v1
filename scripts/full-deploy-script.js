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

  const Whitelist = await hre.ethers.getContractFactory('TestWhitelist')
  const whitelist = await Whitelist.deploy()
  await whitelist.deployed()

  console.log('Whitelist deployed to: ', whitelist.address)

  const UniswapAdapter = await hre.ethers.getContractFactory('UniswapAdapter')
  const uniswapAdapter = await UniswapAdapter.deploy(
    deployedContracts[process.env.HARDHAT_NETWORK].uniswapFactory,
    deployedContracts[process.env.HARDHAT_NETWORK].weth
  )
  await uniswapAdapter.deployed()

  console.log('UniswapAdapter deployed to: ', uniswapAdapter.address)

  const PortfolioControllerDeployer = await hre.ethers.getContractFactory('PortfolioControllerDeployer')
  const deployer = await PortfolioControllerDeployer.deploy()
  await deployer.deployed()

  console.log('PortfolioControllerDeployer deployed to: ', deployer.address)

  const controllerAddress = await deployer.controller()

  console.log('PortfolioController deployed to: ', controllerAddress)

  const LoopRouter = await hre.ethers.getContractFactory('LoopRouter')
  const loopRouter = await LoopRouter.deploy(
    uniswapAdapter.address,
    deployedContracts[process.env.HARDHAT_NETWORK].uniswapFactory,
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

  const Portfolio = await hre.ethers.getContractFactory('Portfolio')
  const portfolioImplementation = await Portfolio.deploy()
  await portfolioImplementation.deployed()

  const PortfolioProxyFactory = await hre.ethers.getContractFactory('PortfolioProxyFactory')
  const portfolioFactory = await PortfolioProxyFactory.deploy(
    portfolioImplementation.address,
    controllerAddress,
    oracle.address,
    whitelist.address
  )
  await portfolioFactory.deployed()

  console.log('PortfolioProxyFactory deployed to:', portfolioFactory.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
