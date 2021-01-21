const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
const WETH9 = require('@uniswap/v2-periphery/build/WETH9.json')
const UniswapV2Factory = require('@uniswap/v2-core/build/UniswapV2Factory.json')
const UniswapV2Pair = require('@uniswap/v2-core/build/UniswapV2Pair.json')
const { expect } = require('chai')
const { ethers, waffle } = require('hardhat')
const { deployContract, provider } = waffle
const { constants, Contract } = ethers
const { WeiPerEther } = constants
const {uniswapTokensForEther, getPortfolioTokensUniswap, DIVISOR} = require('../scripts/utils.js')


function percentageOf(numerator, denominator) {
  if (numerator == 0 || denominator == 0) return 0
  return (Number(numerator.mul(100000).div(denominator)) / 1000).toFixed(2)
}

async function logTokenBalances(portfolio, address) {
  const addressBalances = await portfolio.getTokenBalances(address)
  console.log('Account ', address, ' Balances: ')
  for (let i = 0; i < addressBalances.length; i++) {
    console.log('Token ', i, ' ', ethers.utils.formatEther(addressBalances[i]))
  }
}

async function logPortfolioTokens(portfolio, acc, msg) {
  console.log('\n', msg)
  const totalValue = await portfolio.totalValue()
  let tokens = await portfolio.portfolioTokens()
  const tokenValues = await portfolio.tokenValues()
  const tokPercentages = await portfolio.getTokenPercentages()
  const totalImbalance = await portfolio.getTotalImbalance()
  const portfolioBalances = await portfolio.getTokenBalances(portfolio.address)
  const percentageOff = totalImbalance.isZero() ? 0 : percentageOf(totalImbalance, totalValue)
  console.log('Account: ', acc)
  console.log('Portfolio - Total Value: ', ethers.utils.formatEther(totalValue))
  console.log('Portfolio - Total Imbalance: ', ethers.utils.formatEther(totalImbalance))
  console.log('Portfolio - Percent Imbalance: ', percentageOff)
  for (let tokenId = 0; tokenId < tokens.length; tokenId++) {
    console.log('Portfolio Token ID: ', tokenId)
    console.log(' - Balance: ', ethers.utils.formatEther(portfolioBalances[tokenId]))
    console.log(' - Percentage Desired: ', percentageOf(tokPercentages[tokenId], DIVISOR), '\n - Actual Percentage: ', percentageOf(tokenValues[tokenId], totalValue))
  }
}

describe('FlashPortfolio', function () {
  const NUM_TOKENS = 15
  const TOKEN_SUPPLY = 100000000000
  const tokens = []
  let accounts, uniswapFactory, uniswapRouter, oracle, loopController, flashController, portfolio, portfolioTokens, portfolioTokenAddresses, portfolioPercentages, whitelist, arbitrager, multicall, balancesLibrary


  before('Setup Uniswap', async function () {
    accounts = await ethers.getSigners()
    const UNISWAP_DEPLOYER = accounts[6]
    const WETH_SUPPLIER = accounts[7]
    const ERC20_DEPLOYER = accounts[11]


    uniswapFactory = await deployContract(UNISWAP_DEPLOYER, UniswapV2Factory, [UNISWAP_DEPLOYER.address])
    for (let i = 0; i < NUM_TOKENS; i++) {
      if (i === 0) {
        const token = await deployContract(WETH_SUPPLIER, WETH9)
        await token.deposit({ value: WeiPerEther.mul(NUM_TOKENS) })
        tokens.push(token)
      } else {
        const token = await deployContract(ERC20_DEPLOYER, ERC20, [WeiPerEther.mul(TOKEN_SUPPLY)])
        tokens.push(token)

        await uniswapFactory.createPair(tokens[0].address, token.address)
        const pairAddress = await uniswapFactory.getPair(tokens[0].address, token.address)
        const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), provider)
        // Add liquidity
        await tokens[0].connect(WETH_SUPPLIER).transfer(pairAddress, WeiPerEther)
        await token.transfer(pairAddress, WeiPerEther.mul(TOKEN_SUPPLY))
        await pair.connect(UNISWAP_DEPLOYER).mint(ERC20_DEPLOYER.address)
      }
    }
  })

  before('Setup Routers', async function () {
    const Whitelist = await ethers.getContractFactory('TestWhitelist')
    whitelist = await Whitelist.connect(accounts[0]).deploy()
    await whitelist.deployed()

    const UniswapRouter = await ethers.getContractFactory('UniswapRouter')
    uniswapRouter = await UniswapRouter.connect(accounts[0]).deploy(
      uniswapFactory.address,
      tokens[0].address,
      whitelist.address
    )
    await uniswapRouter.deployed()
  })

  before('Setup Controllers', async function () {
    const Oracle = await ethers.getContractFactory('TestOracle')
    oracle = await Oracle.connect(accounts[0]).deploy(
      uniswapFactory.address,
      tokens[0].address
    )
    await oracle.deployed()

    const UniswapFlashController = await ethers.getContractFactory('UniswapFlashController')
    flashController = await UniswapFlashController.connect(accounts[0]).deploy(
      uniswapRouter.address,
      uniswapFactory.address,
      tokens[0].address
    )
    await flashController.deployed()

    const LoopController = await ethers.getContractFactory('LoopController')
    loopController = await LoopController.connect(accounts[0]).deploy(
      uniswapRouter.address,
      uniswapFactory.address,
      tokens[0].address
    )
    await loopController.deployed()

  })

  before('Deploy Balances library', async function () {
    const Balances = await ethers.getContractFactory('Balances')
    balancesLibrary = await Balances.connect(accounts[4]).deploy()
  })

  before('Deploy GenericController', async function () {
    const TRADER = accounts[10]
    const Multicall = await ethers.getContractFactory('GenericController')
    multicall = await Multicall.connect(accounts[4]).deploy()
    arbitrager = await Multicall.connect(TRADER).deploy()
  })

  it('Should deposit + rebalance flash portfolio using uniswap router', async function () {
    portfolioTokens = [
      tokens[1],
      tokens[2],
      tokens[3],
      tokens[4],
      tokens[5],
      tokens[6],
      tokens[7],
      tokens[8],
      tokens[9],
      tokens[10],
      tokens[11],
      tokens[12],
      tokens[13],
      tokens[14],
    ]
    //Percentages are multiples of 1000, so 20% = 0.2 = 200
    portfolioPercentages = [
      200,
      200,
      50,
      50,
      50,
      50,
      50,
      50,
      50,
      50,
      50,
      50,
      50,
      50
    ]
    portfolioTokenAddresses = portfolioTokens.map(p => p.address)

    // Deploy portfolio
    const FlashPortfolio = await ethers.getContractFactory('FlashPortfolio', { libraries: { Balances: balancesLibrary.address } })
    portfolio = await FlashPortfolio.connect(accounts[4]).deploy(
      portfolioTokenAddresses,
      portfolioPercentages,
      oracle.address
    )
    await portfolio.deployed()
    const tx = await portfolio.deployTransaction.wait()
    console.log('Gas Used - deploy portfolio implementation:  ', tx.gasUsed.toString())

    // Get calldata to swap tokens from uniswap into portfolio for deposit
    const portfolioDepositWeth = WeiPerEther.mul(10)

    // Multicall gets initial tokens from uniswap
    let swapCall = await getPortfolioTokensUniswap(portfolio, multicall, uniswapRouter, oracle, portfolioDepositWeth, multicall.address)
    let swap1 = await multicall.execute(swapCall, { value: portfolioDepositWeth })
    const swap1Receipt = await swap1.wait()
    console.log('Gas Used - batch uniswap swaps: ', swap1Receipt.gasUsed.toString())

    await logTokenBalances(portfolio, multicall.address)

    // Deposit tokens for eth from uniswap during deposit
    // TODO: hitting a revert with no error msg
    let arbitrageCalls = await uniswapTokensForEther(portfolio, multicall, uniswapRouter, oracle, portfolioTokens, multicall.address)


    // let test = await multicall.execute(arbitrageCalls)


    // // console.log('number of arbitrage calls: ', arbitrageCalls.length)
    // // Get calldata to batch swap deposit into portfolio
    let depositCalls = await getPortfolioTokensUniswap(portfolio, multicall, uniswapRouter, oracle, portfolioDepositWeth, portfolio.address)

    // // Deposit into portfolio
    // // depositCalls.concat(arbitrageCalls)
    // let combinedCalls = arbitrageCalls.concat(depositCalls)
    // // console.log('debug - ', depositCalls)
    // console.log('number of internal calls: ', combinedCalls.length)

    const depositTx1 = await multicall.initiateRebalance(portfolio.address, [], [], depositCalls, { value: portfolioDepositWeth.mul(4) })
    const depositReceipt1 = await depositTx1.wait()
    console.log('Gas Used - deposit() (14 tokens):  ', depositReceipt1.gasUsed.toString())
    await logPortfolioTokens(portfolio, multicall.address, "===========First deposit===========")

    // // repeat call to deposit more tokens
    const depositTx2 = await multicall.initiateRebalance(portfolio.address, [], [], depositCalls, { value: portfolioDepositWeth.mul(2) })
    const depositReceipt2 = await depositTx2.wait()
    console.log('Gas Used - deposit() (14 tokens):  ', depositReceipt2.gasUsed.toString())
    await logPortfolioTokens(portfolio, multicall.address, "===========Second deposit===========")

    // // manually make portfolio out of balance by sending it extra tokens
    // await portfolioTokens[0].transfer(portfolio.address, WeiPerEther)
    // await logPortfolioTokens(portfolio, multicall.address, "=============PORTFOLIO HAS FLOATED OUT OF BALANCE============")

    // // encode call to take token + have portfolio token burned
    // let rebalanceCall = await encodeTransferFrom(portfolioTokens[0], portfolio.address, multicall.address, WeiPerEther)

    // // Rebalance using multicall + regular token transfers
    // const rebalanceTx1 = await multicall.initiateRebalance(portfolio.address, [portfolioTokens[0].address], [WeiPerEther.mul(1)], rebalanceCall)
    // await logPortfolioTokens(portfolio, multicall.address, "============POST REBALANCE===========")

    // const receipt1 = await rebalanceTx1.wait()

    // console.log("Gas Used - rebalance:rebalance(): ", receipt1.gasUsed.toString())
  })
})
