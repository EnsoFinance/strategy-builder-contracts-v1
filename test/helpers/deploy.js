const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
const WETH9 = require('@uniswap/v2-periphery/build/WETH9.json')
const UniswapV2Factory = require('@uniswap/v2-core/build/UniswapV2Factory.json')
const UniswapV2Pair = require('@uniswap/v2-core/build/UniswapV2Pair.json')
const { ethers, waffle } = require('hardhat')
const { deployContract, provider } = waffle
const { constants, Contract, getContractFactory } = ethers
const { WeiPerEther } = constants

module.exports = {
  deployUniswap: async (owner, numTokens) => {
    const tokens = []
    const uniswapFactory = await deployContract(owner, UniswapV2Factory, [owner.address])
    console.log('Uniswap factory: ', uniswapFactory.address)
    for(let i = 0; i < numTokens; i++) {
      if (i === 0) {
        const token = await deployContract(owner, WETH9)
        token.deposit({ value: WeiPerEther.mul(100*(numTokens-1))})
        tokens.push(token)
        console.log("Weth: ", token.address)
      } else {
        const token = await deployContract(owner, ERC20, [WeiPerEther.mul(10000)])
        tokens.push(token)
        await uniswapFactory.createPair(tokens[0].address, token.address)
        const pairAddress = await uniswapFactory.getPair(tokens[0].address, token.address)
        const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), provider)
        // Add liquidity
        await tokens[0].transfer(pairAddress, WeiPerEther.mul(100))
        await token.transfer(pairAddress, WeiPerEther.mul(100))
        await pair.connect(owner).mint(owner.address)
      }
    }
    return [uniswapFactory, tokens]
  },
  deployUniswapRouter: async (owner, uniswapFactory, weth) => {
    const UniswapRouter = await getContractFactory('UniswapRouter')
    const router = await UniswapRouter.connect(owner).deploy(
      uniswapFactory.address,
      weth.address
    )
    await router.deployed()
    return router
  },
  deployPlatform: async (owner, controller, uniswapFactory, weth) => {
    const Oracle = await getContractFactory('TestOracle')
    const oracle = await Oracle.connect(owner).deploy(
        uniswapFactory.address,
        weth.address
    )
    await oracle.deployed()
    console.log("Oracle: ", oracle.address)

    const Whitelist = await getContractFactory('TestWhitelist')
    const whitelist = await Whitelist.connect(owner).deploy()
    await whitelist.deployed()
    console.log("Whitelist: ", whitelist.address)

    await whitelist.connect(owner).approve(controller.address)

    const Portfolio = await getContractFactory('Portfolio')
    const portfolioImplementation = await Portfolio.connect(owner).deploy()
    await portfolioImplementation.deployed()

    const PortfolioProxyFactory = await getContractFactory('PortfolioProxyFactory')
    const portfolioFactory = await PortfolioProxyFactory.connect(owner).deploy(
      portfolioImplementation.address,
      oracle.address,
      whitelist.address,
      controller.address
    )
    await portfolioFactory.deployed()
    console.log("Portfolio Factory: ", portfolioFactory.address)

    return [portfolioFactory, oracle, whitelist]
  },
  deployLoopController: async (owner, uniswapFactory, weth) => {
    const UniswapRouter = await getContractFactory('UniswapRouter')
    const router = await UniswapRouter.connect(owner).deploy(
      uniswapFactory.address,
      weth.address
    )
    await router.deployed()

    const LoopController = await getContractFactory('LoopController')
    const controller = await LoopController.connect(owner).deploy(
      router.address,
      uniswapFactory.address,
      weth.address
    )
    await controller.deployed()

    return [controller, router]
  },
  deployGenericController: async (owner, weth) => {
    const GenericController = await ethers.getContractFactory('GenericController')
    const controller = await GenericController.connect(owner).deploy(weth.address)
    await controller.deployed()
    return controller
  }
}
