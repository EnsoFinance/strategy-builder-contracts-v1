const { expect } = require('chai')
const { ethers } = require('hardhat')
//const { displayBalances } = require('./helpers/logging.js')
const { deployUniswap, deployTokens, deployPlatform, deployUniswapAdapter, deployGenericRouter } = require('./helpers/deploy.js')
const { preparePortfolio, prepareRebalanceMulticall, prepareDepositMulticall, calculateAddress } = require('./helpers/encode.js')
const { prepareFlashLoan } = require('./helpers/cookbook.js')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 4
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 1209600 // Two weeks
let WETH;

describe('Flash Loan', function () {
    let tokens, accounts, uniswapFactory, sushiFactory, portfolioFactory, controller, oracle, whitelist, genericRouter, uniswapAdapter, sushiAdapter, arbitrager, portfolio, portfolioTokens, portfolioPercentages, wrapper

    it('Setup Uniswap, Sushiswap, Factory, GenericRouter', async function() {
      accounts = await getSigners();
      tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(200*(NUM_TOKENS-1)));
      WETH = tokens[0];
      uniswapFactory = await deployUniswap(accounts[0], tokens);
      sushiFactory = await deployUniswap(accounts[0], tokens);
      uniswapAdapter = await deployUniswapAdapter(accounts[0], uniswapFactory, WETH);
      sushiAdapter = await deployUniswapAdapter(accounts[0], sushiFactory, WETH);
      [portfolioFactory, controller, oracle, whitelist ] = await deployPlatform(accounts[0], uniswapFactory, WETH);
      genericRouter = await deployGenericRouter(accounts[0], controller, WETH);
      await whitelist.connect(accounts[0]).approve(genericRouter.address)
    })

    it('Should deploy portfolio', async function() {
      const name = 'Test Portfolio'
      const symbol = 'TEST'
      const positions = [
        {token: tokens[1].address, percentage: 500},
        {token: tokens[2].address, percentage: 300},
        {token: tokens[3].address, percentage: 200}
      ];

      [portfolioTokens, portfolioPercentages] = preparePortfolio(positions, uniswapAdapter.address);

      const create2Address = await calculateAddress(portfolioFactory, accounts[1].address, name, symbol, portfolioTokens, portfolioPercentages)
      const Portfolio = await getContractFactory('Portfolio')
      portfolio = await Portfolio.attach(create2Address)

      const total = ethers.BigNumber.from('10000000000000000')
      const calls = await prepareDepositMulticall(portfolio, controller, genericRouter, uniswapAdapter, uniswapFactory, WETH, total, portfolioTokens, portfolioPercentages)
      const data = await genericRouter.encodeCalls(calls);

      await portfolioFactory.connect(accounts[1]).createPortfolio(
        name,
        symbol,
        portfolioTokens,
        portfolioPercentages,
        false,
        0,
        REBALANCE_THRESHOLD,
        SLIPPAGE,
        TIMELOCK,
        genericRouter.address,
        data,
        { value: ethers.BigNumber.from('10000000000000000')}
      )

      const LibraryWrapper = await getContractFactory('LibraryWrapper')
      wrapper = await LibraryWrapper.connect(accounts[0]).deploy(
          oracle.address,
          portfolio.address
      )
      await wrapper.deployed()

      //await displayBalances(wrapper, portfolioTokens, WETH)
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
        await uniswapAdapter.connect(accounts[2]).swap(
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
        await tokens[1].connect(accounts[2]).approve(sushiAdapter.address, tokenBalance)
        await sushiAdapter.connect(accounts[2]).swap(
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
        const rebalanceCalls = await prepareRebalanceMulticall(portfolio, controller, genericRouter, uniswapAdapter, oracle, uniswapFactory, WETH)
        const flashLoanCalls = await prepareFlashLoan(portfolio, arbitrager, uniswapAdapter, sushiAdapter, ethers.BigNumber.from('1000000000000000'), tokens[1], WETH)
        const calls = [...rebalanceCalls, ...flashLoanCalls]
        const data = await genericRouter.encodeCalls(calls);
        const tx = await controller.connect(accounts[1]).rebalance(portfolio.address, genericRouter.address, data)
        const receipt = await tx.wait()
        console.log('Gas Used: ', receipt.gasUsed.toString())
        const balanceAfter = await tokens[1].balanceOf(accounts[1].address)
        expect(balanceAfter.gt(balanceBefore)).to.equal(true)
        console.log('Tokens Earned: ', balanceAfter.sub(balanceBefore).toString())
    })
})
