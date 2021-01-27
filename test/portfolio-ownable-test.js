const { expect } = require('chai')
const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero } = constants
const { deployUniswap, deployPlatform, deployLoopController } = require('./helpers/deploy.js')
const { preparePortfolio } = require('./helpers/utils.js')

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH;

describe('PortfolioOwnable', function() {
  let tokens, accounts, uniswapFactory, portfolioFactory, controller, router, portfolio, portfolioTokens, portfolioPercentages, portfolioRouters

  before('Setup Uniswap + Factory', async function() {
    accounts = await getSigners();
    [uniswapFactory, tokens] = await deployUniswap(accounts[0], NUM_TOKENS);
    WETH = tokens[0];
    [controller, router] = await deployLoopController(accounts[0], uniswapFactory, WETH);
    [portfolioFactory, , ] = await deployPlatform(accounts[0], controller, uniswapFactory, WETH);
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

  it('Should fail to transfer ownership: not owner', async function() {
    await expect(portfolio.connect(accounts[2]).transferOwnership(accounts[2].address)).to.be.revertedWith()
  })

  it('Should fail to transfer ownership: zero address', async function() {
    await expect(portfolio.connect(accounts[1]).transferOwnership(AddressZero)).to.be.revertedWith()
  })

  it('Should transfer ownership', async function() {
    await portfolio.connect(accounts[1]).transferOwnership(accounts[2].address)
    expect(await portfolio.owner()).to.equal(accounts[2].address)
  })

  it('Should fail to renounce ownership: not owner', async function() {
    await expect(portfolio.connect(accounts[1]).renounceOwnership()).to.be.revertedWith()
  })

  it('Should renounce ownership', async function() {
    await portfolio.connect(accounts[2]).renounceOwnership()
    expect(await portfolio.owner()).to.equal(AddressZero)
  })
});
