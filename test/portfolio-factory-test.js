const { expect } = require('chai')
const { ethers } = require('hardhat')
const { getContractFactory, getSigners } = ethers
const { deployUniswap, deployPlatform, deployLoopController } = require('./helpers/deploy.js')
const { preparePortfolio } = require('./helpers/utils.js')

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH;

describe('PortfolioProxyFactory', function() {
  let tokens, accounts, uniswapFactory, portfolioFactory, oracle, controller, router, portfolio, portfolioTokens, portfolioPercentages, portfolioRouters, newFactory, newOracle, newWhitelist, newController, newImplementationAddress

  before('Setup Uniswap + Factory', async function() {
    accounts = await getSigners();
    [uniswapFactory, tokens] = await deployUniswap(accounts[0], NUM_TOKENS);
    WETH = tokens[0];
    [controller, router] = await deployLoopController(accounts[0], uniswapFactory, WETH);
    [portfolioFactory, oracle, ] = await deployPlatform(accounts[0], controller, uniswapFactory, WETH);
  })

  before('Setup new implementation, oracle, whitelist', async function() {
    [newController, ] = await deployLoopController(accounts[0], uniswapFactory, WETH);
    [newFactory, newOracle, newWhitelist] = await deployPlatform(accounts[0], newController, uniswapFactory, WETH);
    newImplementationAddress = await newFactory.implementation()
  })

  before('Should deploy portfolio', async function() {
    console.log('Portfolio factory: ', portfolioFactory.address)
    const positions = [
      {token: tokens[1].address, percentage: 500},
      {token: tokens[2].address, percentage: 500},
    ];
    [portfolioTokens, portfolioPercentages, portfolioRouters] = preparePortfolio(positions, router.address);
    // let duplicateTokens = portfolioTokens
    // duplicateTokens[0] = portfolioTokens[1]
    // TODO: portfolio is currently accepting duplicate tokens
    const amount = ethers.BigNumber.from('10000000000000000')
    let tx = await portfolioFactory.connect(accounts[1]).createPortfolio(
      'Test Portfolio',
      'TEST',
      portfolioRouters,
      portfolioTokens,
      portfolioPercentages,
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
    await expect(portfolio.connect(accounts[1]).deposit(portfolioRouters, [], newController.address, {value: ethers.BigNumber.from('10000000000000000')})).to.be.revertedWith('Controller is not approved')
    await portfolioFactory.connect(accounts[0]).updateWhitelist(newWhitelist.address)
    expect(await portfolioFactory.whitelist()).to.equal(newWhitelist.address)
    await portfolio.connect(accounts[1]).deposit(portfolioRouters, [], newController.address, {value: ethers.BigNumber.from('10000000000000000')})
    const newBalance = await portfolio.balanceOf(accounts[1].address)
    expect(ethers.BigNumber.from(newBalance).gt(oldBalance)).to.equal(true)
  })

  it('Should fail to update controller: not owner', async function() {
    await expect(portfolioFactory.connect(accounts[1]).updateController(newController.address)).to.be.revertedWith('caller is not the owner')
  })

  it('Should update implementation', async function() {
    portfolioFactory.connect(accounts[0]).updateController(newController.address)
    expect(await portfolioFactory.controller()).to.equal(newController.address)
  })

  it('Should fail to update implementation: not owner', async function() {
    await expect(portfolioFactory.connect(accounts[1]).updateImplementation(newImplementationAddress)).to.be.revertedWith('caller is not the owner')
  })

  it('Should update implementation', async function() {
    portfolioFactory.connect(accounts[0]).updateImplementation(newImplementationAddress)
    expect(await portfolioFactory.implementation()).to.equal(newImplementationAddress)
    expect(ethers.BigNumber.from(await portfolioFactory.version()).eq(2)).to.equal(true)
    expect(await portfolioFactory.getProxyImplementation(portfolio.address)).to.not.equal(newImplementationAddress)
  })

  it('Should fail to upgrade portfolio proxy: not admin', async function() {
    await expect(portfolioFactory.connect(accounts[0]).upgrade(portfolio.address)).to.be.revertedWith('User not admin')
  })

  it('Should upgrade portfolio proxy', async function() {
    await portfolioFactory.connect(accounts[1]).upgrade(portfolio.address)
    expect(await portfolioFactory.getProxyImplementation(portfolio.address)).to.equal(newImplementationAddress)
  })

  it('Should fail to change proxy admin: not admin', async function() {
    await expect(portfolioFactory.connect(accounts[2]).changeProxyAdmin(portfolio.address, newFactory.address)).to.be.revertedWith('User not admin')
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
