const { expect } = require('chai')
const { ethers } = require('hardhat')
const { displayBalances } = require('./helpers/logging.js')
const { deployUniswap, deployTokens, deployPlatform, deployUniswapAdapter, deployGenericRouter } = require('./helpers/deploy.js')
const { preparePortfolio, prepareRebalanceMulticall, prepareDepositMulticall } = require('./helpers/utils.js')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 15
let WETH;
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 1209600 // Two weeks

describe('GenericRouter', function () {
    let tokens, accounts, uniswapFactory, portfolioFactory, controller, oracle, whitelist, genericRouter, adapter, portfolio, portfolioTokens, portfolioPercentages, portfolioAdapters, wrapper

    before('Setup Uniswap, Factory, GenericRouter', async function() {
      accounts = await getSigners();
      tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100*(NUM_TOKENS-1)));
      WETH = tokens[0];
      uniswapFactory = await deployUniswap(accounts[0], tokens);
      adapter = await deployUniswapAdapter(accounts[0], uniswapFactory, WETH);
      [portfolioFactory, controller, oracle, whitelist ] = await deployPlatform(accounts[0], uniswapFactory, WETH);
      genericRouter = await deployGenericRouter(accounts[0], controller, WETH);
      await whitelist.connect(accounts[0]).approve(genericRouter.address)
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
      [portfolioTokens, portfolioPercentages, portfolioAdapters] = preparePortfolio(positions, adapter.address);
      // let duplicateTokens = portfolioTokens
      // duplicateTokens[0] = portfolioTokens[1]
      // TODO: portfolio is currently accepting duplicate tokens
      let tx = await portfolioFactory.connect(accounts[1]).createPortfolio(
        'Test Portfolio',
        'TEST',
        portfolioAdapters,
        portfolioTokens,
        portfolioPercentages,
        REBALANCE_THRESHOLD,
        SLIPPAGE,
        TIMELOCK
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

      const total = ethers.BigNumber.from('10000000000000000')
      const calls = await prepareDepositMulticall(portfolio, genericRouter, adapter, uniswapFactory, WETH, total, portfolioTokens, portfolioPercentages)
      const data = await genericRouter.encodeCalls(calls);
      tx = await controller.connect(accounts[1]).deposit(portfolio.address, genericRouter.address, data, {value: total})
      receipt = await tx.wait()
      console.log('Deposit Gas Used: ', receipt.gasUsed.toString())

      await displayBalances(wrapper, portfolioTokens, WETH)
      //expect(await portfolio.getPortfolioValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
      expect(await wrapper.isBalanced()).to.equal(true)
    })

    it('Should purchase a token, requiring a rebalance', async function () {
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
        await displayBalances(wrapper, portfolioTokens, WETH)
        expect(await wrapper.isBalanced()).to.equal(false)
    })

    it('Should rebalance portfolio with multicall', async function () {
        console.log('Rebalancing portfolio....')
        // Multicall gets initial tokens from uniswap
        const calls = await prepareRebalanceMulticall(portfolio, controller, genericRouter, adapter, oracle, uniswapFactory, WETH)
        const data = await genericRouter.encodeCalls(calls);
        const tx = await controller.connect(accounts[1]).rebalance(portfolio.address, genericRouter.address, data)
        const receipt = await tx.wait()
        console.log('Gas Used: ', receipt.gasUsed.toString())
        await displayBalances(wrapper, portfolioTokens, WETH)
        expect(await wrapper.isBalanced()).to.equal(true)
    })


})
