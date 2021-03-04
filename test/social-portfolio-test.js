const BigNumber = require('bignumber.js')
const { expect } = require('chai')
const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
const { deployTokens, deployUniswap, deployPlatform, deployLoopRouter } = require('./helpers/deploy.js')
//const { displayBalances } = require('./helpers/logging.js')
const { preparePortfolio } = require('./helpers/encode.js')
const { increaseTime, TIMELOCK_CATEGORY } = require('./helpers/utils.js')

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH;

describe('PortfolioController - Social', function () {
  let tokens, accounts, uniswapFactory, portfolioFactory, controller, oracle, whitelist, router, adapter, portfolio, portfolioTokens, portfolioPercentages, portfolioAdapters, wrapper

  before('Setup Uniswap + Factory', async function () {
    accounts = await getSigners();
    tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)));
    WETH = tokens[0];
    uniswapFactory = await deployUniswap(accounts[0], tokens);
    [portfolioFactory, controller, oracle, whitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH);
    [router, adapter] = await deployLoopRouter(accounts[0], controller, uniswapFactory, WETH);
    await whitelist.connect(accounts[0]).approve(router.address);
  })

  it('Should deploy portfolio', async function () {
    console.log('Portfolio factory: ', portfolioFactory.address)
    const positions = [
      { token: tokens[0].address, percentage: 400 },
      { token: tokens[1].address, percentage: 200 },
      { token: tokens[2].address, percentage: 200 },
      { token: tokens[3].address, percentage: 200 }
    ];
    [portfolioTokens, portfolioPercentages, portfolioAdapters] = preparePortfolio(positions, adapter.address);
    let tx = await portfolioFactory.connect(accounts[1]).createPortfolio(
      'Test Portfolio',
      'TEST',
      portfolioAdapters,
      portfolioTokens,
      portfolioPercentages,
      true,
      50, // 5% fee
      REBALANCE_THRESHOLD,
      SLIPPAGE,
      TIMELOCK,
      { value: ethers.BigNumber.from('10000000000000000') }
    )
    let receipt = await tx.wait()
    console.log('Deployment Gas Used: ', receipt.gasUsed.toString())

    const portfolioAddress = receipt.events.find(ev => ev.event === 'NewPortfolio').args.portfolio
    const Portfolio = await getContractFactory('Portfolio')
    portfolio = await Portfolio.attach(portfolioAddress)

    const LibraryWrapper = await getContractFactory('LibraryWrapper')
    wrapper = await LibraryWrapper.connect(accounts[0]).deploy(
      oracle.address,
      portfolioAddress
    )
    await wrapper.deployed()

    //await displayBalances(wrapper, portfolioTokens, WETH)
    //expect(await portfolio.getPortfolioValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
    expect(await wrapper.isBalanced()).to.equal(true)
  })

  it('Should fail to withdraw performance fee: no earnings', async function () {
    await expect(controller.connect(accounts[1]).withdrawPerformanceFee(portfolio.address)).to.be.revertedWith('No earnings')
  })

  it('Should purchase tokens, requiring a rebalance', async function () {
    // Approve the user to use the adapter
    const value = WeiPerEther.mul(50)
    await adapter.connect(accounts[2]).swap(
      value,
      0,
      AddressZero,
      tokens[1].address,
      accounts[2].address,
      accounts[2].address,
      [],
      [],
      { value: value }
    )
    await adapter.connect(accounts[2]).swap(
      value,
      0,
      AddressZero,
      tokens[2].address,
      accounts[2].address,
      accounts[2].address,
      [],
      [],
      { value: value }
    )
    //await displayBalances(wrapper, portfolioTokens, WETH)
    expect(await wrapper.isBalanced()).to.equal(false)
  })

  it('Should rebalance portfolio', async function () {
    const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
    const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
    const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
    const tx = await controller.connect(accounts[1]).rebalance(portfolio.address, router.address, data)
    const receipt = await tx.wait()
    console.log('Gas Used: ', receipt.gasUsed.toString())
    //await displayBalances(wrapper, portfolioTokens, WETH)
    expect(await wrapper.isBalanced()).to.equal(true)
  })

  it('Should deposit more', async function () {
    const balanceBefore = await portfolio.balanceOf(accounts[2].address)
    const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [portfolioTokens, portfolioAdapters])
    const tx = await controller.connect(accounts[2]).deposit(portfolio.address, router.address, data, { value: ethers.BigNumber.from('10000000000000000') })
    const receipt = await tx.wait()
    console.log('Gas Used: ', receipt.gasUsed.toString())
    const balanceAfter = await portfolio.balanceOf(accounts[2].address)
    //await displayBalances(wrapper, portfolioTokens, WETH)
    expect(await wrapper.isBalanced()).to.equal(true)
    expect(balanceAfter.gt(balanceBefore)).to.equal(true)
  })

  it('Should fail to withdraw performance fee: not manager', async function () {
    await expect(controller.connect(accounts[2]).withdrawPerformanceFee(portfolio.address)).to.be.revertedWith('Not manager')
  })

  it('Should withdraw performance fee', async function () {
    const balanceBefore = await portfolio.balanceOf(accounts[1].address)
    await controller.connect(accounts[1]).withdrawPerformanceFee(portfolio.address)
    const balanceAfter = await portfolio.balanceOf(accounts[1].address)
    expect(balanceAfter.gt(balanceBefore)).to.equal(true)
  })

  it('Should withdraw', async function () {
    const amount = ethers.BigNumber.from('10000000000000')
    const supplyBefore = BigNumber((await portfolio.totalSupply()).toString())
    const tokenBalanceBefore = BigNumber((await tokens[1].balanceOf(portfolio.address)).toString())
    const tx = await controller.connect(accounts[1]).withdrawAssets(portfolio.address, amount)
    const receipt = await tx.wait()
    console.log('Gas Used: ', receipt.gasUsed.toString())
    const supplyAfter = BigNumber((await portfolio.totalSupply()).toString())
    const tokenBalanceAfter = BigNumber((await tokens[1].balanceOf(portfolio.address)).toString())
    expect(supplyBefore.minus(amount.toString()).isEqualTo(supplyAfter)).to.equal(true)
    expect(supplyBefore.dividedBy(supplyAfter).decimalPlaces(10).isEqualTo(tokenBalanceBefore.dividedBy(tokenBalanceAfter).decimalPlaces(10))).to.equal(true)
    expect(tokenBalanceBefore.isGreaterThan(tokenBalanceAfter)).to.equal(true)
  })

  it('Should restructure', async function () {
    const positions = [
      { token: tokens[0].address, percentage: 300 },
      { token: tokens[1].address, percentage: 300 },
      { token: tokens[2].address, percentage: 400 }
    ];
    [portfolioTokens, portfolioPercentages, portfolioAdapters] = preparePortfolio(positions, adapter.address);
    await controller.connect(accounts[1]).restructure(portfolio.address, portfolioTokens, portfolioPercentages)
  })

  it('Should fail to restructure: time lock active', async function () {
    await expect(controller.connect(accounts[1]).restructure(portfolio.address, [], [])).to.be.revertedWith('Timelock active')
  })

  it('Should fail to update value: time lock active', async function () {
    await expect(controller.connect(accounts[1]).updateValue(portfolio.address, TIMELOCK_CATEGORY.TIMELOCK, 0)).to.be.revertedWith('Timelock active')
  })

  it('Should fail to finalize structure: time lock not passed', async function () {
    const currentTokens = await portfolio.tokens()
    const sellAdapters = currentTokens.map(() => adapter.address)

    await expect( controller.connect(accounts[1]).finalizeStructure(portfolio.address, router.address, sellAdapters, portfolioAdapters))
      .to.be.revertedWith('Timelock active')
  })

  it('Should finalize structure', async function () {
    await increaseTime(TIMELOCK)
    const currentTokens = await portfolio.tokens()
    const sellAdapters = currentTokens.map(() => adapter.address)

    await controller.connect(accounts[1]).finalizeStructure(portfolio.address, router.address, sellAdapters, portfolioAdapters)
    //await displayBalances(wrapper, portfolioTokens, WETH)
  })

  it('Should purchase a token, requiring a rebalance', async function () {
    const value = WeiPerEther.mul(100)
    await adapter.connect(accounts[2]).swap(
      value,
      0,
      AddressZero,
      tokens[2].address,
      accounts[2].address,
      accounts[2].address,
      [],
      [],
      { value: value }
    )
    //await displayBalances(wrapper, portfolioTokens, WETH)
    expect(await wrapper.isBalanced()).to.equal(false)
  })

  it('Should rebalance portfolio', async function () {
    const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
    const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
    const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
    const tx = await controller.connect(accounts[1]).rebalance(portfolio.address, router.address, data)
    const receipt = await tx.wait()
    console.log('Gas Used: ', receipt.gasUsed.toString())
    //await displayBalances(wrapper, portfolioTokens, WETH)
    expect(await wrapper.isBalanced()).to.equal(true)
  })

  it('Should update timelock + fail to finalize: timelock active', async function () {
    await controller.connect(accounts[1]).updateValue(portfolio.address, TIMELOCK_CATEGORY.TIMELOCK, 0)
    await expect( controller.connect(accounts[1]).finalizeValue(portfolio.address)).to.be.revertedWith('Timelock active')
  })
});
