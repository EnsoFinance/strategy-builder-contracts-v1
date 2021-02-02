const { expect } = require('chai')
const { ethers } = require('hardhat')
const { displayBalances } = require('./helpers/logging.js')
const { deployUniswap, deployTokens, deployPlatform, deployUniswapRouter, deployGenericController } = require('./helpers/deploy.js')
const { preparePortfolio, prepareMulticall } = require('./helpers/utils.js')
const { flashloan } = require('./helpers/cookbook.js')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 4
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 1209600 // Two weeks
let WETH;

describe('Flash Loan', function () {
    let tokens, accounts, uniswapFactory, sushiFactory, portfolioFactory, oracle, genericController, uniswapRouter, sushiRouter, arbitrager, portfolio, portfolioTokens, portfolioPercentages, portfolioRouters, wrapper

    before('Setup Uniswap, Sushiswap, Factory, GenericController', async function() {
      accounts = await getSigners();
      tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(200*(NUM_TOKENS-1)));
      WETH = tokens[0];
      uniswapFactory = await deployUniswap(accounts[0], tokens);
      sushiFactory = await deployUniswap(accounts[0], tokens);
      uniswapRouter = await deployUniswapRouter(accounts[0], uniswapFactory, WETH);
      sushiRouter = await deployUniswapRouter(accounts[0], sushiFactory, WETH);
      genericController = await deployGenericController(accounts[0], WETH);
      [portfolioFactory, oracle, ] = await deployPlatform(accounts[0], genericController, uniswapFactory, WETH);
    })

    it('Should deploy portfolio', async function() {
      console.log('Portfolio factory: ', portfolioFactory.address)
      const positions = [
        {token: tokens[1].address, percentage: 500},
        {token: tokens[2].address, percentage: 300},
        {token: tokens[3].address, percentage: 200}
      ];
      [portfolioTokens, portfolioPercentages, portfolioRouters] = preparePortfolio(positions, uniswapRouter.address);
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

    it('Should deploy arbitrager contract', async function() {
        const Arbitrager = await getContractFactory('Arbitrager')
        arbitrager = await Arbitrager.connect(accounts[1]).deploy()
        await arbitrager.deployed()
        console.log("Arbitrager: ", arbitrager.address)
    })

    it('Should purchase a token, requiring a rebalance and create arbitrage opportunity', async function () {
        const value = WeiPerEther.mul(50)
        await uniswapRouter.connect(accounts[2]).swap(
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
        const tokenBalance = await tokens[1].balanceOf(accounts[2].address)
        await tokens[1].connect(accounts[2]).approve(sushiRouter.address, tokenBalance)
        await sushiRouter.connect(accounts[2]).swap(
            tokenBalance,
            0,
            tokens[1].address,
            AddressZero,
            accounts[2].address,
            accounts[2].address,
            [],
            []
        )
        expect(await wrapper.isBalanced()).to.equal(false)
    })

    it('Should rebalance portfolio with multicall + flash loan', async function () {
        console.log('Rebalancing portfolio....')
        const balanceBefore = await tokens[1].balanceOf(accounts[1].address)
        // Multicall gets initial tokens from uniswap
        const rebalanceCalls = await prepareMulticall(portfolio, genericController, uniswapRouter, oracle, wrapper, WETH)
        const flashLoanCalls = await flashloan(portfolio, arbitrager, uniswapRouter, sushiRouter, ethers.BigNumber.from('1000000000000000'), tokens[1], WETH)
        const calls = [...rebalanceCalls, ...flashLoanCalls]
        const data = await genericController.encodeCalls(calls);
        const tx = await portfolio.connect(accounts[1]).rebalance(data, genericController.address)
        const receipt = await tx.wait()
        console.log('Gas Used: ', receipt.gasUsed.toString())
        const balanceAfter = await tokens[1].balanceOf(accounts[1].address)
        expect(balanceAfter.gt(balanceBefore)).to.equal(true)
        console.log('Tokens Earned: ', balanceAfter.sub(balanceBefore).toString())
    })


})
