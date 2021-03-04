const BigNumber = require('bignumber.js')
const { expect } = require('chai')
const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
const { deployTokens, deployUniswap, deployPlatform, deployLoopRouter } = require('./helpers/deploy.js')
//const { displayBalances } = require('./helpers/logging.js')
const { preparePortfolio } = require('./helpers/encode.js')
const { TIMELOCK_CATEGORY } = require('./helpers/utils.js')

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH;

describe('PortfolioController', function () {
  let tokens, accounts, uniswapFactory, portfolioFactory, controller, oracle, whitelist, router, adapter, portfolio, portfolioTokens, portfolioPercentages, portfolioAdapters, wrapper, newThreshold

  before('Setup Uniswap + Factory', async function () {
    accounts = await getSigners();
    tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)));
    WETH = tokens[0];
    uniswapFactory = await deployUniswap(accounts[0], tokens);
    [portfolioFactory, controller, oracle, whitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH);
    [router, adapter] = await deployLoopRouter(accounts[0], controller, uniswapFactory, WETH);
    await whitelist.connect(accounts[0]).approve(router.address);
  })

  it('Should fail to deploy portfolio: threshold too high', async function () {
    await expect(portfolioFactory.connect(accounts[1]).createPortfolio(
      'Fail Portfolio',
      'FAIL',
      [],
      [],
      [],
      false,
      0,
      10001,
      SLIPPAGE,
      TIMELOCK
    )).to.be.revertedWith('slippage/threshold high');
  })

  it('Should fail to deploy portfolio: slippage too high', async function () {
    await expect(portfolioFactory.connect(accounts[1]).createPortfolio(
      'Fail Portfolio',
      'FAIL',
      [],
      [],
      [],
      false,
      0,
      REBALANCE_THRESHOLD,
      1001,
      TIMELOCK
    )).to.be.revertedWith('slippage/threshold high');
  })

  it('Should deploy portfolio', async function () {
    console.log('Portfolio factory: ', portfolioFactory.address)
    const positions = [
      { token: tokens[1].address, percentage: 200 },
      { token: tokens[2].address, percentage: 200 },
      { token: tokens[3].address, percentage: 50 },
      { token: tokens[4].address, percentage: 50 },
      { token: tokens[5].address, percentage: 50 },
      { token: tokens[6].address, percentage: 50 },
      { token: tokens[7].address, percentage: 50 },
      { token: tokens[8].address, percentage: 50 },
      { token: tokens[9].address, percentage: 50 },
      { token: tokens[10].address, percentage: 50 },
      { token: tokens[11].address, percentage: 50 },
      { token: tokens[12].address, percentage: 50 },
      { token: tokens[13].address, percentage: 50 },
      { token: tokens[14].address, percentage: 50 },
    ];
    [portfolioTokens, portfolioPercentages, portfolioAdapters] = preparePortfolio(positions, adapter.address);
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

  it('Should fail to setup portfolio: initialized', async function () {
    await expect(controller.setupPortfolio(accounts[1].address, portfolio.address, [], false, 0, 0, 0, 0)).to.be.revertedWith('already setup')
  })

  it('Should fail to update value: restructure is invalid option', async function () {
    await expect(controller.connect(accounts[1]).updateValue(portfolio.address, TIMELOCK_CATEGORY.RESTRUCTURE, 0)).to.be.revertedWith('')
  })

  it('Should fail to update value: option out of bounds', async function () {
    await expect(controller.connect(accounts[1]).updateValue(portfolio.address, 5, 0)).to.be.revertedWith('')
  })

  it('Should fail to update threshold: not manager', async function () {
    await expect(controller.connect(accounts[0]).updateValue(portfolio.address, TIMELOCK_CATEGORY.THRESHOLD, 1)).to.be.revertedWith('Not manager')
  })

  it('Should fail to update threshold: value too large', async function () {
    await expect(controller.connect(accounts[1]).updateValue(portfolio.address, TIMELOCK_CATEGORY.THRESHOLD, 1001)).to.be.revertedWith('PC.uV: Value too high')
  })

  it('Should update threshold', async function () {
    newThreshold = 15
    await controller.connect(accounts[1]).updateValue(portfolio.address, TIMELOCK_CATEGORY.THRESHOLD, newThreshold)
  })

  it('Should fail to finalize restrucuture: timelock not set for restructure', async function () {
    await expect(controller.connect(accounts[1]).finalizeStructure(portfolio.address, router.address, [], [])).to.be.revertedWith('Wrong category')
  })

  it('Should finalize value', async function () {
    expect(ethers.BigNumber.from(await controller.rebalanceThreshold(portfolio.address)).eq(REBALANCE_THRESHOLD)).to.equal(true)
    await controller.finalizeValue(portfolio.address)
    expect(ethers.BigNumber.from(await controller.rebalanceThreshold(portfolio.address)).eq(newThreshold)).to.equal(true)
  })

  it('Should fail to update slippage: not manager', async function () {
    await expect(controller.connect(accounts[0]).updateValue(portfolio.address, TIMELOCK_CATEGORY.SLIPPAGE, 1)).to.be.revertedWith('Not manager')
  })

  it('Should fail to update slippage: value too large', async function () {
    await expect(controller.connect(accounts[1]).updateValue(portfolio.address, TIMELOCK_CATEGORY.SLIPPAGE, 1001)).to.be.revertedWith('PC.uV: Value too high')
  })

  it('Should update slippage', async function () {
    const slippage = 996
    await controller.connect(accounts[1]).updateValue(portfolio.address, TIMELOCK_CATEGORY.SLIPPAGE, slippage)
    await controller.finalizeValue(portfolio.address)
    expect(ethers.BigNumber.from(await controller.slippage(portfolio.address)).eq(slippage)).to.equal(true)
  })

  it('Should fail to update timelock: not manager', async function () {
    await expect(controller.connect(accounts[0]).updateValue(portfolio.address, TIMELOCK_CATEGORY.TIMELOCK, 1)).to.be.revertedWith('Not manager')
  })

  it('Should update timelock', async function () {
    const timelock = 1
    await controller.connect(accounts[1]).updateValue(portfolio.address, TIMELOCK_CATEGORY.TIMELOCK, timelock)
    await controller.finalizeValue(portfolio.address)
    expect(ethers.BigNumber.from(await controller.timelock(portfolio.address)).eq(timelock)).to.equal(true)
  })

  it('Should fail to rebalance, already balanced', async function () {
    const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
    const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
    const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
    await expect(controller.connect(accounts[1]).rebalance(portfolio.address, router.address, data))
      .to.be.revertedWith('PC.rebalance: balanced'
      )
  })

  it('Should purchase a token, requiring a rebalance', async function () {
    // Approve the user to use the adapter
    const value = WeiPerEther.mul(50)
    await adapter.connect(accounts[2]).swap(
      value,
      0,
      AddressZero,
      portfolioTokens[0],
      accounts[2].address,
      accounts[2].address,
      [],
      [],
      { value: value }
    )
    //await displayBalances(wrapper, portfolioTokens, WETH)
    expect(await wrapper.isBalanced()).to.equal(false)
  })

  it('Should fail to rebalance, router not approved', async function () {
    const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
    const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
    const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
    await expect(controller.connect(accounts[1]).rebalance(portfolio.address, AddressZero, data))
      .to.be.revertedWith('Router not approved')
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

  it('Should fail to rebalance, only manager may rebalance', async function () {
    const estimates = await Promise.all(portfolioTokens.map(async token => (await wrapper.getTokenValue(token)).toString()))
    const total = estimates.reduce((total, value) => BigNumber(total.toString()).plus(value)).toString()
    const data = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], [total, estimates])
    await expect(controller.connect(accounts[2]).rebalance(portfolio.address, router.address, data))
      .to.be.revertedWith('Not manager')
  })

  it('Should fail to deposit: not manager', async function () {
    const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [portfolioTokens, portfolioAdapters])
    await expect(controller.connect(accounts[0]).deposit(portfolio.address, router.address, data, { value: ethers.BigNumber.from('10000000000000000') }))
      .to.be.revertedWith('Not manager')
  })

  it('Should fail to deposit: no funds deposited', async function () {
    const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [portfolioTokens, portfolioAdapters])
    await expect(controller.connect(accounts[1]).deposit(portfolio.address, router.address, data))
      .to.be.revertedWith('PC.deposit: No ether sent')
  })

  it('Should fail to deposit: incorrect adapters', async function () {
    const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [portfolioTokens, []])
    await expect(controller.connect(accounts[1]).deposit(portfolio.address, router.address, data, { value: ethers.BigNumber.from('10000000000000000') }))
      .to.be.revertedWith('Routers/tokens mismatch')
  })

  it('Should deposit more', async function () {
    const balanceBefore = await portfolio.balanceOf(accounts[1].address)
    const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [portfolioTokens, portfolioAdapters])
    const tx = await controller.connect(accounts[1]).deposit(portfolio.address, router.address, data, { value: ethers.BigNumber.from('10000000000000000') })
    const receipt = await tx.wait()
    console.log('Gas Used: ', receipt.gasUsed.toString())
    const balanceAfter = await portfolio.balanceOf(accounts[1].address)
    //await displayBalances(wrapper, portfolioTokens, WETH)
    expect(await wrapper.isBalanced()).to.equal(true)
    expect(balanceAfter.gt(balanceBefore)).to.equal(true)
  })

  it('Should fail to withdraw: no portfolio tokens', async function () {
    await expect(controller.connect(accounts[0]).withdrawAssets(portfolio.address, 1))
      .to.be.revertedWith('ERC20: Amount exceeds balance')
  })

  it('Should fail to withdraw: no amount passed', async function () {
    await expect(controller.connect(accounts[1]).withdrawAssets(portfolio.address, 0))
      .to.be.revertedWith('PC.withdraw: No amount')
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

  it('Should fail to restructure: wrong array length', async function () {
    const positions = [
      { token: tokens[0].address, percentage: 500 },
      { token: tokens[1].address, percentage: 500 },
      { token: tokens[2].address, percentage: 0 }
    ];
    [portfolioTokens, portfolioPercentages, portfolioAdapters] = preparePortfolio(positions, adapter.address);
    await expect(controller.connect(accounts[1]).restructure(portfolio.address, portfolioTokens, [500, 500]))
      .to.be.revertedWith('invalid input lengths')
  })

  it('Should fail to restructure: wrong percentages', async function () {
    const positions = [
      { token: tokens[0].address, percentage: 300 },
      { token: tokens[1].address, percentage: 300 },
      { token: tokens[2].address, percentage: 300 }
    ];
    [portfolioTokens, portfolioPercentages, portfolioAdapters] = preparePortfolio(positions, adapter.address);
    await expect(controller.connect(accounts[1]).restructure(portfolio.address, portfolioTokens, portfolioPercentages))
      .to.be.revertedWith('total percentage wrong')
  })

  it('Should fail to restructure: not manager', async function () {
    const positions = [
      { token: tokens[0].address, percentage: 300 },
      { token: tokens[1].address, percentage: 300 },
      { token: tokens[2].address, percentage: 400 }
    ];
    [portfolioTokens, portfolioPercentages, portfolioAdapters] = preparePortfolio(positions, adapter.address);
    await expect(controller.connect(accounts[2]).restructure(portfolio.address, portfolioTokens, portfolioPercentages))
      .to.be.revertedWith('Not manager')
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

  it('Should fail to finalize value: wrong category', async function () {
    await expect(controller.finalizeValue(portfolio.address)).to.be.revertedWith("Wrong category")
  })

  it('Should fail to finalize structure: sell adapters mismatch', async function () {
    await expect(controller.connect(accounts[1]).finalizeStructure(portfolio.address, router.address, portfolioAdapters, portfolioAdapters))
      .to.be.revertedWith('PC._fS: Sell adapters length')
  })

  it('Should fail to finalize structure: buy adapters mismatch', async function () {
    const currentTokens = await portfolio.tokens()
    const sellAdapters = currentTokens.map(() => adapter.address)

    await expect(controller.connect(accounts[1]).finalizeStructure(portfolio.address, router.address, sellAdapters, sellAdapters))
      .to.be.revertedWith('PC._fS: Buy adapters length')
  })

  /* Not social
  it('Should fail to finalize structure: time lock not passed', async function() {
    await expect( controller.connect(accounts[1]).finalizeStructure(portfolio.address, router.addressportfolioTokens, portfolioPercentages, portfolioAdapters, portfolioAdapters))
      .to.be.revertedWith('Can only restructure after enough time has passed')
  })
  */

  it('Should finalize structure', async function () {
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

  it('Should fail to open portfolio: not manager', async function () {
    await expect(controller.connect(accounts[0]).openPortfolio(portfolio.address, 0)).to.be.revertedWith('Not manager')
  })

  it('Should fail to open portfolio: fee too high', async function () {
    await expect(controller.connect(accounts[1]).openPortfolio(portfolio.address, 1000)).to.be.revertedWith('Fee too high')
  })

  it('Should open portfolio', async function () {
    await controller.connect(accounts[1]).openPortfolio(portfolio.address, 10)
    expect(await controller.social(portfolio.address)).to.equal(true)
  })

  it('Should call update on oracle', async function() {
    const tx = await oracle.update(tokens[1].address)
    const receipt = await tx.wait()
    const newPriceEvent = receipt.events.find(ev => ev.event === 'NewPrice').args
    expect(newPriceEvent.token.toLowerCase()).to.equal(tokens[1].address.toLowerCase())
    expect(newPriceEvent.price.gt(0)).to.equal(true)
  })

  it('Should return 0 when passing 0 to consult', async function() {
    const value = await oracle.consult(0, tokens[1].address)
    expect(value.eq(0)).to.equal(true)
  })

  it('Should return value when consult oracle about weth price', async function() {
    const value = await oracle.consult(1, tokens[0].address)
    expect(value.eq(1)).to.equal(true)
  })

  it('Should return 0 when estimating total of ETH in portfolio', async function() {
    const [total, estimates] = await oracle.estimateTotal(portfolio.address, [AddressZero])
    expect(total.eq(0)).to.equal(true)
    expect(estimates[0].eq(0)).to.equal(true)
  })
});
