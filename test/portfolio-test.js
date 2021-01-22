const BigNumber = require('bignumber.js')
const { expect } = require('chai')
const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
const { deployUniswap, deployPlatform } = require('./helpers/deploy.js')
const { lookupBalances } = require('./helpers/balances.js')
const { preparePortfolio } = require('./helpers/portfolio.js')

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH;

describe('Portfolio', function() {
  let tokens, accounts, uniswapFactory, portfolioFactory, oracle, defaultController, defaultRouter, portfolio, portfolioTokens, portfolioPercentages, portfolioRouters, wrapper, whitelist

  before('Setup Uniswap', async function() {
    accounts = await getSigners();
    [uniswapFactory, tokens] = await deployUniswap(accounts[0], NUM_TOKENS);
    WETH = tokens[0];

    [portfolioFactory, oracle, whitelist, defaultController, defaultRouter] = await deployPlatform(accounts[0], uniswapFactory, WETH);
  })

  it('Should deploy portfolio', async function() {
    console.log('Portfolio factory: ', portfolioFactory.address)
    const positions = [
      {token: tokens[1].address, percentage: 200},
      {token: tokens[2].address, percentage: 200},
      {token: tokens[3].address, percentage: 50},
      {token: tokens[4].address, percentage: 50},
      {token: tokens[5].address, percentage: 50},
      {token: tokens[6].address, percentage: 50},
      {token: tokens[7].address, percentage: 50},
      {token: tokens[8].address, percentage: 50},
      {token: tokens[9].address, percentage: 50},
      {token: tokens[10].address, percentage: 50},
      {token: tokens[11].address, percentage: 50},
      {token: tokens[12].address, percentage: 50},
      {token: tokens[13].address, percentage: 50},
      {token: tokens[14].address, percentage: 50},
    ];
    [portfolioTokens, portfolioPercentages, portfolioRouters] = preparePortfolio(positions, defaultRouter.address);
    let tx = await portfolioFactory.connect(accounts[1]).createPortfolio(
      'Test Portfolio',
      'TEST',
      portfolioRouters,
      portfolioTokens,
      portfolioPercentages,
      REBALANCE_THRESHOLD,
      SLIPPAGE,
      TIMELOCK,
      { value: ethers.BigNumber.from('10000000000000000')}
    )
    let receipt = await tx.wait()
    console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

    const portfolioAddress = receipt.events.find(ev => ev.event === 'NewPortfolio').args.portfolio
    const Portfolio = await getContractFactory('Portfolio')
    portfolio = Portfolio.attach(portfolioAddress)
    /*
    tx = await portfolio.connect(accounts[1]).deposit(portfolioRouters, [], defaultController.address, { value: ethers.BigNumber.from('10000000000000000')})
    receipt = await tx.wait()
    console.log('Deposit Gas Used: ', receipt.gasUsed.toString())
    */
    const LibraryWrapper = await getContractFactory('LibraryWrapper')
    wrapper = await LibraryWrapper.connect(accounts[0]).deploy(
        oracle.address,
        portfolioAddress
    )
    await wrapper.deployed()

    await lookupBalances(wrapper, portfolioTokens, WETH)
    //expect(await portfolio.getPortfolioValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
    expect(await wrapper.isBalanced()).to.equal(true)
  })

  it('Should fail to rebalance, already balanced', async function() {
    const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
    const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
    const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
    await expect(portfolio.connect(accounts[1]).rebalance(data, defaultController.address))
      .to.be.revertedWith('No point rebalancing a balanced portfolio')
  })

  it('Should purchase a token, requiring a rebalance', async function() {
    // Approve the user to use the router
    await whitelist.connect(accounts[0]).approve(accounts[2].address)
    const value = WeiPerEther.mul(50)
    await defaultRouter.connect(accounts[2]).swap(
      value,
      0,
      AddressZero,
      tokens[1].address,
      accounts[2].address,
      accounts[2].address,
      [],
      [],
      { value: value}
    )
    await lookupBalances(wrapper, portfolioTokens, WETH)
    expect(await wrapper.isBalanced()).to.equal(false)
  })

  it('Should fail to rebalance, controller not approved', async function() {
    const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
    const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
    const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
    await expect(portfolio.connect(accounts[1]).rebalance(data, AddressZero))
      .to.be.revertedWith('Controller is not approved')
  })

  it('Should rebalance portfolio', async function() {
    const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
    const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
    const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
    const tx = await portfolio.connect(accounts[1]).rebalance(data, defaultController.address)
    const receipt = await tx.wait()
    console.log('Gas Used: ', receipt.gasUsed.toString())
    await lookupBalances(wrapper, portfolioTokens, WETH)
    expect(await wrapper.isBalanced()).to.equal(true)
  })

  it('Should fail to rebalance, only manager may rebalance', async function() {
    const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
    const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
    const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
    await expect(portfolio.connect(accounts[2]).rebalance(data, defaultController.address))
      .to.be.revertedWith('Rebalance only open on social portfolios')
  })

  it('Should fail to deposit: not owner', async function() {
    await expect(portfolio.connect(accounts[0]).deposit(portfolioRouters, [], defaultController.address, { value: ethers.BigNumber.from('10000000000000000')}))
      .to.be.revertedWith('Only owner may deposit on non-social profiles')
  })

  it('Should fail to deposit: no funds deposited', async function() {
    await expect(portfolio.connect(accounts[1]).deposit(portfolioRouters, [], defaultController.address))
      .to.be.revertedWith('No ether sent with transaction')
  })

  it('Should fail to deposit: incorrect routers', async function() {
    await expect(portfolio.connect(accounts[1]).deposit([], [], defaultController.address, { value: ethers.BigNumber.from('10000000000000000')}))
      .to.be.revertedWith('Need to pass a router address for each token in the portfolio')
  })

  it('Should deposit more', async function () {
    const balanceBefore = await portfolio.balanceOf(accounts[1].address)
    console.log('Balance before: ', balanceBefore.toString())
    const tx = await portfolio.connect(accounts[1]).deposit(portfolioRouters, [], defaultController.address, { value: ethers.BigNumber.from('10000000000000000')})
    const receipt = await tx.wait()
    console.log('Gas Used: ', receipt.gasUsed.toString())
    const balanceAfter = await portfolio.balanceOf(accounts[1].address)
    console.log('Balance after: ', balanceAfter.toString())
    await lookupBalances(wrapper, portfolioTokens, WETH)
    expect(await wrapper.isBalanced()).to.equal(true)
    expect(balanceAfter.sub(balanceBefore).lt(balanceBefore)).to.equal(true)
  })

  it('Should fail to withdraw: no portfolio tokens', async function() {
    await expect(portfolio.connect(accounts[0]).withdraw(1, [], defaultController.address))
      .to.be.revertedWith('burn amount exceeds balance')
  })

  it('Should fail to withdraw: no amount passed', async function() {
    await expect(portfolio.connect(accounts[1]).withdraw(0, [], defaultController.address))
      .to.be.revertedWith('No amount set')
  })

  it('Should withdraw', async function () {
    const tx = await portfolio.connect(accounts[1]).withdraw(ethers.BigNumber.from('10000000000000'), [], defaultController.address)
    const receipt = await tx.wait()
    console.log('Gas Used: ', receipt.gasUsed.toString())
    await lookupBalances(wrapper, portfolioTokens, WETH)
    expect(await wrapper.isBalanced()).to.equal(true)
  })

  it('Should fail to restructure: wrong array length', async function () {
    const positions = [
      {token: tokens[1].address, percentage: 500},
      {token: tokens[2].address, percentage: 500},
      {token: tokens[3].address, percentage: 0}
    ];
    [portfolioTokens, portfolioPercentages, portfolioRouters] = preparePortfolio(positions, defaultRouter.address);
    await expect( portfolio.connect(accounts[1]).restructure(portfolioTokens, [500, 500]))
      .to.be.revertedWith('Different array lengths')
  })

  it('Should fail to restructure: wrong percentages', async function () {
    const positions = [
      {token: tokens[1].address, percentage: 300},
      {token: tokens[2].address, percentage: 300},
      {token: tokens[3].address, percentage: 300}
    ];
    [portfolioTokens, portfolioPercentages, portfolioRouters] = preparePortfolio(positions, defaultRouter.address);
    await expect( portfolio.connect(accounts[1]).restructure(portfolioTokens, portfolioPercentages))
      .to.be.revertedWith('Percentages do not add up to 100%')
  })

  it('Should fail to restructure: not owner', async function () {
    const positions = [
      {token: tokens[1].address, percentage: 300},
      {token: tokens[2].address, percentage: 300},
      {token: tokens[3].address, percentage: 400}
    ];
    [portfolioTokens, portfolioPercentages, portfolioRouters] = preparePortfolio(positions, defaultRouter.address);
    await expect( portfolio.connect(accounts[2]).restructure(portfolioTokens, portfolioPercentages))
      .to.be.revertedWith('caller is not the owner')
  })

  it('Should restructure', async function () {
    const positions = [
      {token: tokens[1].address, percentage: 300},
      {token: tokens[2].address, percentage: 300},
      {token: tokens[3].address, percentage: 400}
    ];
    [portfolioTokens, portfolioPercentages, portfolioRouters] = preparePortfolio(positions, defaultRouter.address);
    await portfolio.connect(accounts[1]).restructure(portfolioTokens, portfolioPercentages)
  })

  it('Should fail to finalize structure: sell routers mismatch', async function() {
    await expect( portfolio.connect(accounts[1]).finalizeStructure(portfolioTokens, portfolioPercentages, portfolioRouters, portfolioRouters, defaultController.address))
      .to.be.revertedWith('Sell routers length mismatch')
  })

  it('Should fail to finalize structure: buy routers mismatch', async function() {
    const currentTokens = await portfolio.getPortfolioTokens()
    const sellRouters = currentTokens.map(() => defaultRouter.address)

    await expect( portfolio.connect(accounts[1]).finalizeStructure(portfolioTokens, portfolioPercentages, sellRouters, sellRouters, defaultController.address))
      .to.be.revertedWith('Buy routers length mismatch')
  })

  /* Not social
  it('Should fail to finalize structure: time lock not passed', async function() {
    await expect( portfolio.connect(accounts[1]).finalizeStructure(portfolioTokens, portfolioPercentages, portfolioRouters, portfolioRouters, defaultController.address))
      .to.be.revertedWith('Can only restructure after enough time has passed')
  })
  */

  it('Should finalize structure', async function() {
    const currentTokens = await portfolio.getPortfolioTokens()
    const sellRouters = currentTokens.map(() => defaultRouter.address)

    await portfolio.connect(accounts[1]).finalizeStructure(portfolioTokens, portfolioPercentages, sellRouters, portfolioRouters, defaultController.address)
    await lookupBalances(wrapper, portfolioTokens, WETH)
  })

  it('Should purchase a token, requiring a rebalance', async function() {
    const value = WeiPerEther.mul(100)
    await defaultRouter.connect(accounts[2]).swap(
      value,
      0,
      AddressZero,
      tokens[3].address,
      accounts[2].address,
      accounts[2].address,
      [],
      [],
      { value: value}
    )
    await lookupBalances(wrapper, portfolioTokens, WETH)
    expect(await wrapper.isBalanced()).to.equal(false)
  })

  /* THIS STRATEGY NEEDS TO BE OPTIMIZED -- TOO MUCH SLIPPAGE
  it('Should rebalance portfolio with flash strategy', async function() {
    const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
    const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
    const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
    const tx = await portfolio.connect(accounts[1]).rebalance(data, flashController.address)
    const receipt = await tx.wait()
    console.log('Gas Used: ', receipt.gasUsed.toString())
    await lookupBalances(wrapper, portfolioTokens)
    expect(await wrapper.isBalanced()).to.equal(true)
  })
  */
});
