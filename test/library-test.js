const { expect } = require('chai')
const { ethers } = require('hardhat')
const { deployUniswap, deployTokens, deployPlatform, deployUniswapAdapter, deployGenericRouter } = require('./helpers/deploy.js')
const { preparePortfolio } = require('./helpers/encode.js')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants

const NUM_TOKENS = 15
let WETH;
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 1209600 // Two weeks

describe('PortfolioLibrary', function () {
    let tokens, accounts, uniswapFactory, portfolioFactory, controller, oracle, whitelist, genericRouter, adapter, portfolioTokens, portfolioPercentages, portfolioAdapters, wrapper

    before('Setup LibraryWrapper', async function() {
      accounts = await getSigners();
      tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100*(NUM_TOKENS-1)));
      WETH = tokens[0];
      uniswapFactory = await deployUniswap(accounts[0], tokens);
      adapter = await deployUniswapAdapter(accounts[0], uniswapFactory, WETH);
      [portfolioFactory, controller, oracle, whitelist ] = await deployPlatform(accounts[0], uniswapFactory, WETH);
      genericRouter = await deployGenericRouter(accounts[0], controller, WETH);
      await whitelist.connect(accounts[0]).approve(genericRouter.address)

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

      const total = ethers.BigNumber.from('10000000000000000')
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
        {value: total}
      )
      let receipt = await tx.wait()

      const portfolioAddress = receipt.events.find(ev => ev.event === 'NewPortfolio').args.portfolio

      const LibraryWrapper = await getContractFactory('LibraryWrapper')
      wrapper = await LibraryWrapper.connect(accounts[0]).deploy(
          oracle.address,
          portfolioAddress
      )
      await wrapper.deployed()
      expect(await wrapper.isBalanced()).to.equal(true)
    })

    it('Should not have ETH token value', async function() {
      const value = await wrapper.getTokenValue(AddressZero)
      expect(value.eq(0)).to.equal(true)
    })

    it('Should return range of 0', async function() {
      const value = await wrapper.getRange(100, 0)
      expect(value.eq(0)).to.equal(true)
    })
})
