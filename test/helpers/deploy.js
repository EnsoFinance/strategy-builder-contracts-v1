const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
const WETH9 = require('@uniswap/v2-periphery/build/WETH9.json')
const UniswapV2Factory = require('@uniswap/v2-core/build/UniswapV2Factory.json')
const UniswapV2Pair = require('@uniswap/v2-core/build/UniswapV2Pair.json')
const { ethers, waffle } = require('hardhat')
const { deployContract, provider } = waffle
const { constants, Contract, getContractFactory } = ethers
const { WeiPerEther } = constants

module.exports = {
  deployUniswap: async (owner, tokens) => {
    const uniswapFactory = await deployContract(owner, UniswapV2Factory, [owner.address])
    //console.log('Uniswap factory: ', uniswapFactory.address)
    for(let i = 0; i < tokens.length; i++) {
      if (i !== 0) { //tokens[0] is used as the trading pair (WETH)
        await uniswapFactory.createPair(tokens[0].address, tokens[i].address)
        const pairAddress = await uniswapFactory.getPair(tokens[0].address, tokens[i].address)
        const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), provider)
        // Add liquidity
        await tokens[0].transfer(pairAddress, WeiPerEther.mul(100))
        await tokens[i].transfer(pairAddress, WeiPerEther.mul(100))
        await pair.connect(owner).mint(owner.address)
      }
    }
    return uniswapFactory
  },
  deployTokens: async (owner, numTokens, value) => {
    const tokens = []
    for (let i = 0; i < numTokens; i++) {
      if (i === 0) {
        const token = await deployContract(owner, WETH9)
        token.deposit({ value: value })
        tokens.push(token)
        //console.log("Weth: ", token.address)
      } else {
        const token = await deployContract(owner, ERC20, [WeiPerEther.mul(10000)])
        tokens.push(token)
      }
    }
    return tokens
  },
  deployUniswapAdapter: async (owner, uniswapFactory, weth) => {
    const UniswapAdapter = await getContractFactory('UniswapAdapter')
    const adapter = await UniswapAdapter.connect(owner).deploy(uniswapFactory.address, weth.address)
    await adapter.deployed()
    //console.log('Uniswap adapter: ', adapter.address)
    return adapter
  },
  deployPlatform: async (owner, uniswapFactory, weth) => {
    const Oracle = await getContractFactory('UniswapNaiveOracle')
    const oracle = await Oracle.connect(owner).deploy(uniswapFactory.address, weth.address)
    await oracle.deployed()
    //console.log("Oracle: ", oracle.address)

    const Whitelist = await getContractFactory('TestWhitelist')
    const whitelist = await Whitelist.connect(owner).deploy()
    await whitelist.deployed()
    //console.log("Whitelist: ", whitelist.address)

    const PortfolioControllerDeployer = await getContractFactory('PortfolioControllerDeployer')
    const deployer = await PortfolioControllerDeployer.connect(owner).deploy()
    await deployer.deployed()

    const controllerAddress = await deployer.controller()
    const PortfolioController = await getContractFactory('PortfolioController')
    const controller = await PortfolioController.attach(controllerAddress)

    const Portfolio = await getContractFactory('Portfolio')
    const portfolioImplementation = await Portfolio.connect(owner).deploy()
    await portfolioImplementation.deployed()

    const PortfolioProxyFactory = await getContractFactory('PortfolioProxyFactory')
    const portfolioFactory = await PortfolioProxyFactory.connect(owner).deploy(
      portfolioImplementation.address,
      controllerAddress,
      oracle.address,
      whitelist.address
    )
    await portfolioFactory.deployed()
    //console.log("Portfolio Factory: ", portfolioFactory.address)

    return [portfolioFactory, controller, oracle, whitelist]
  },
  deployLoopRouter: async (owner, controller, uniswapFactory, weth) => {
    //console.log('Controller: ', controller.address);
    //console.log('WETH: ', weth.address);
    const UniswapAdapter = await getContractFactory('UniswapAdapter')
    const adapter = await UniswapAdapter.connect(owner).deploy(
      uniswapFactory.address,
      weth.address
    )
    await adapter.deployed()

    const LoopRouter = await getContractFactory('LoopRouter')
    const router = await LoopRouter.connect(owner).deploy(
      adapter.address,
      uniswapFactory.address,
      controller.address,
      weth.address
    )
    await router.deployed()

    return [router, adapter]
  },
  deployGenericRouter: async (owner, controller, weth) => {
    const GenericRouter = await ethers.getContractFactory('GenericRouter')
    const router = await GenericRouter.connect(owner).deploy(controller.address, weth.address)
    await router.deployed()
    return router
  },
  deployDsProxyFactory: async (owner) => {
    const DsProxyFactory = await ethers.getContractFactory('DSProxyFactory')
    const dsProxyFactory = await DsProxyFactory.connect(owner).deploy()
    await dsProxyFactory.deployed()
    console.log('DsProxyFactory: ', dsProxyFactory.address)
    return dsProxyFactory
  },
  deployDsProxy: async (dsProxyFactory, owner) => {
    const tx = await dsProxyFactory.build(owner.address)
    const receipt = await tx.wait()
    const proxyAddress = receipt.events.find((ev) => ev.event === 'Created').args.proxy
    const DsProxy = await getContractFactory('DSProxy')
    const dsProxy = DsProxy.attach(proxyAddress)
    console.log('DsProxy: ', dsProxy.address)
    return dsProxy
  },
}
