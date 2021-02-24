const { expect } = require('chai')
const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners } = ethers
const { WeiPerEther } = constants
const { deployTokens, deployUniswap, deployPlatform, deployLoopRouter } = require('./helpers/deploy.js')
const { preparePortfolio } = require('./helpers/utils.js')

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH;

describe('PortfolioProxyFactory', function() {
  let tokens, accounts, uniswapFactory, portfolioFactory, controller, oracle, whitelist, router, adapter, portfolio, portfolioTokens, portfolioPercentages, portfolioAdapters, newFactory, newController, newOracle, newWhitelist, newRouter, newImplementationAddress

  before('Setup Uniswap + Factory', async function() {
    accounts = await getSigners();
    tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100*(NUM_TOKENS-1)));
    WETH = tokens[0];
    uniswapFactory = await deployUniswap(accounts[0], tokens);
    [portfolioFactory, controller, oracle, whitelist ] = await deployPlatform(accounts[0], uniswapFactory, WETH);
    [router, adapter] = await deployLoopRouter(accounts[0], controller, uniswapFactory, WETH);
    await whitelist.connect(accounts[0]).approve(router.address);
  })

  before('Setup new implementation, oracle, whitelist', async function() {
    [newFactory, , newOracle, newWhitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH);
    [newRouter, ] = await deployLoopRouter(accounts[0], controller, uniswapFactory, WETH);
    await newWhitelist.connect(accounts[0]).approve(newRouter.address);
    newImplementationAddress = await newFactory.implementation()
  })

  before('Should deploy portfolio', async function() {
    console.log('Portfolio factory: ', portfolioFactory.address)
    const positions = [
      {token: tokens[1].address, percentage: 500},
      {token: tokens[2].address, percentage: 500},
    ];
    [portfolioTokens, portfolioPercentages, portfolioAdapters] = preparePortfolio(positions, adapter.address);
    // let duplicateTokens = portfolioTokens
    // duplicateTokens[0] = portfolioTokens[1]
    // TODO: portfolio is currently accepting duplicate tokens
    const amount = ethers.BigNumber.from('10000000000000000')
    let tx = await portfolioFactory.connect(accounts[1]).createPortfolio(
      'Test Portfolio',
      'TEST',
      portfolioAdapters,
      portfolioTokens,
      portfolioPercentages,
      false,
      0,
      REBALANCE_THRESHOLD,
      SLIPPAGE,
      TIMELOCK,
      { value: amount }
    )
    let receipt = await tx.wait()
    console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

    const portfolioAddress = receipt.events.find(ev => ev.event === 'NewPortfolio').args.portfolio
    const Portfolio = await getContractFactory('Portfolio')
    portfolio = Portfolio.attach(portfolioAddress)
  })

  it('Should fail to update oracle: not owner', async function() {
    await expect(portfolioFactory.connect(accounts[1]).updateOracle(newOracle.address)).to.be.revertedWith('caller is not the owner')
  })

  it('Should update oracle', async function() {
    expect(await portfolio.oracle()).to.equal(oracle.address)
    await portfolioFactory.connect(accounts[0]).updateOracle(newOracle.address)
    expect(await portfolioFactory.oracle()).to.equal(newOracle.address)
    expect(await portfolio.oracle()).to.equal(newOracle.address)
  })

  it('Should fail to update whitelist: not owner', async function() {
    await expect(portfolioFactory.connect(accounts[1]).updateWhitelist(newWhitelist.address)).to.be.revertedWith('caller is not the owner')
  })

  it('Should update whitelist', async function() {
    const oldBalance = await portfolio.balanceOf(accounts[1].address)
    const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [portfolioTokens, portfolioAdapters])
    await expect(controller.connect(accounts[1]).deposit(portfolio.address, newRouter.address, data, {value: ethers.BigNumber.from('10000000000000000')})).to.be.revertedWith('Router not approved')
    await portfolioFactory.connect(accounts[0]).updateWhitelist(newWhitelist.address)
    expect(await portfolioFactory.whitelist()).to.equal(newWhitelist.address)
    await controller.connect(accounts[1]).deposit(portfolio.address, newRouter.address, data, {value: ethers.BigNumber.from('10000000000000000')})
    const newBalance = await portfolio.balanceOf(accounts[1].address)
    expect(ethers.BigNumber.from(newBalance).gt(oldBalance)).to.equal(true)
  })

  it('Should fail to update implementation: not owner', async function() {
    await expect(portfolioFactory.connect(accounts[1]).updateImplementation(newImplementationAddress)).to.be.revertedWith('caller is not the owner')
  })

  it('Should update implementation', async function() {
    await portfolioFactory.connect(accounts[0]).updateImplementation(newImplementationAddress)
    expect(await portfolioFactory.implementation()).to.equal(newImplementationAddress)
    expect(ethers.BigNumber.from(await portfolioFactory.version()).eq(2)).to.equal(true)
    expect(await portfolioFactory.getProxyImplementation(portfolio.address)).to.not.equal(newImplementationAddress)
  })

  it('Should fail to upgrade portfolio proxy: not admin', async function() {
    await expect(portfolioFactory.connect(accounts[0]).upgrade(portfolio.address)).to.be.revertedWith('PPF.onlyManager: Not manager')
  })

  it('Should upgrade portfolio proxy', async function() {
    await portfolioFactory.connect(accounts[1]).upgrade(portfolio.address)
    expect(await portfolioFactory.getProxyImplementation(portfolio.address)).to.equal(newImplementationAddress)
  })

  it('Should fail to change proxy admin: not admin', async function() {
    await expect(portfolioFactory.connect(accounts[2]).changeProxyAdmin(portfolio.address, newFactory.address)).to.be.revertedWith('PPF.onlyManager: Not manager')
  })

  it('Should change proxy admin', async function() {
    await portfolioFactory.connect(accounts[1]).changeProxyAdmin(portfolio.address, newFactory.address)
    expect(await newFactory.getProxyAdmin(portfolio.address)).to.equal(newFactory.address)
  })

  it('Should fail to get implementation: not proxy admin', async function() {
    await expect(portfolioFactory.getProxyImplementation(portfolio.address)).to.be.revertedWith()
  })

  it('Should fail to get proxy admin: not proxy admin', async function() {
    await expect(portfolioFactory.getProxyAdmin(portfolio.address)).to.be.revertedWith()
  })
});
