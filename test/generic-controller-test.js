const { expect } = require('chai')
const { ethers } = require('hardhat')
const { displayBalances } = require('./helpers/logging.js')
const { deployUniswap, deployTokens, deployPlatform, deployUniswapRouter, deployGenericController } = require('./helpers/deploy.js')
const { preparePortfolio, prepareRebalanceMulticall } = require('./helpers/utils.js')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 15
let WETH;
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 1209600 // Two weeks

describe('GenericController', function () {
    let tokens, accounts, uniswapFactory, portfolioFactory, oracle, genericController, router, portfolio, portfolioTokens, portfolioPercentages, portfolioRouters, wrapper

    before('Setup Uniswap, Factory, GenericController', async function() {
      accounts = await getSigners();
      tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100*(NUM_TOKENS-1)));
      WETH = tokens[0];
      uniswapFactory = await deployUniswap(accounts[0], tokens);
      router = await deployUniswapRouter(accounts[0], uniswapFactory, WETH);
      genericController = await deployGenericController(accounts[0], WETH);
      [portfolioFactory, oracle,] = await deployPlatform(accounts[0], genericController, uniswapFactory, WETH);
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

      const LibraryWrapper = await getContractFactory('LibraryWrapper')
      wrapper = await LibraryWrapper.connect(accounts[0]).deploy(
          oracle.address,
          portfolioAddress
      )
      await wrapper.deployed()

      await displayBalances(wrapper, portfolioTokens, WETH)
      //expect(await portfolio.getPortfolioValue()).to.equal(WeiPerEther) // Currently fails because of LP fees
      expect(await wrapper.isBalanced()).to.equal(true)
    })

    it('Should purchase a token, requiring a rebalance', async function () {
        // Approve the user to use the router
        const value = WeiPerEther.mul(50)
        await router.connect(accounts[2]).swap(
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
        const calls = await prepareRebalanceMulticall(portfolio, genericController, router, oracle, WETH)
        const data = await genericController.encodeCalls(calls);
        const tx = await portfolio.connect(accounts[1]).rebalance(data, genericController.address)
        const receipt = await tx.wait()
        console.log('Gas Used: ', receipt.gasUsed.toString())
        await displayBalances(wrapper, portfolioTokens, WETH)
        expect(await wrapper.isBalanced()).to.equal(true)
    })


})
