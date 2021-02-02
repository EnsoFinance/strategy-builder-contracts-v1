const { expect } = require('chai')
const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
const { deployTokens, deployUniswap, deployPlatform, deployLoopController } = require('./helpers/deploy.js')
const { preparePortfolio } = require('./helpers/utils.js')

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH;

describe('PortfolioToken', function() {
  let tokens, accounts, uniswapFactory, portfolioFactory, controller, router, portfolio, portfolioTokens, portfolioPercentages, portfolioRouters, amount

  before('Setup Uniswap + Factory', async function() {
    accounts = await getSigners();
    tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100*(NUM_TOKENS-1)));
    WETH = tokens[0];
    uniswapFactory = await deployUniswap(accounts[0], tokens);
    [controller, router] = await deployLoopController(accounts[0], uniswapFactory, WETH);
    [portfolioFactory, , ] = await deployPlatform(accounts[0], controller, uniswapFactory, WETH);
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
    [portfolioTokens, portfolioPercentages, portfolioRouters] = preparePortfolio(positions, router.address);
    // let duplicateTokens = portfolioTokens
    // duplicateTokens[0] = portfolioTokens[1]
    // TODO: portfolio is currently accepting duplicate tokens
    amount = ethers.BigNumber.from('10000000000000000')
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

    expect(ethers.BigNumber.from(await portfolio.totalSupply()).eq(amount)).to.equal(true)
    expect(ethers.BigNumber.from(await portfolio.balanceOf(accounts[1].address)).eq(amount)).to.equal(true)
  })

  it('Should get name', async function() {
    expect(await portfolio.name()).to.equal('Test Portfolio')
  })

  it('Should get symbol', async function() {
    expect(await portfolio.symbol()).to.equal('TEST')
  })

  it('Should get decimals', async function() {
    expect(ethers.BigNumber.from(await portfolio.decimals()).toString()).to.equal('18')
  })

  it('Should fail to transfer tokens: insufficient funds', async function() {
    const tooMuch = amount.mul(2)
    await expect(portfolio.connect(accounts[1]).transfer(accounts[2].address, tooMuch)).to.be.revertedWith()
  })

  it('Should fail to transfer tokens: zero recipient', async function() {
    await expect(portfolio.connect(accounts[1]).transfer(AddressZero, amount)).to.be.revertedWith()
  })

  it('Should transfer tokens', async function() {
    amount = amount.div(2)
    await portfolio.connect(accounts[1]).transfer(accounts[2].address, amount)
    expect(ethers.BigNumber.from(await portfolio.balanceOf(accounts[2].address)).eq(amount)).to.equal(true)
  })

  it('Should fail to approve tokens: zero spender', async function() {
    await expect(portfolio.connect(accounts[1]).approve(AddressZero, amount)).to.be.revertedWith()
  })

  it('Should approve tokens', async function() {
    await portfolio.connect(accounts[1]).approve(accounts[2].address, amount)
    expect(ethers.BigNumber.from(await portfolio.allowance(accounts[1].address, accounts[2].address)).eq(amount)).to.equal(true)
  })

  it('Should fail to transferFrom tokens: zero spender', async function() {
    await expect(portfolio.connect(accounts[2]).transferFrom(AddressZero, accounts[2].address, amount)).to.be.revertedWith()
  })

  it('Should fail to transferFrom tokens: zero recipient', async function() {
    await expect(portfolio.connect(accounts[2]).transferFrom(accounts[1].address, AddressZero, amount)).to.be.revertedWith()
  })

  it('Should transferFrom tokens', async function() {
    portfolio.connect(accounts[2]).transferFrom(accounts[1].address, accounts[2].address, amount)
    expect(ethers.BigNumber.from(await portfolio.balanceOf(accounts[2].address)).eq(amount.mul(2))).to.equal(true)
    expect(ethers.BigNumber.from(await portfolio.balanceOf(accounts[1].address)).eq(0)).to.equal(true)
  })
});
