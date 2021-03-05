const BigNumber = require('bignumber.js')
const { expect } = require('chai')
const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
const { deployTokens, deployUniswap, deployPlatform, deployLoopRouter } = require('./helpers/deploy.js')
const { preparePortfolio, preparePermit } = require('./helpers/encode.js')

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH;

describe('PortfolioToken', function() {
  let tokens, accounts, uniswapFactory, portfolioFactory, controller, whitelist, router, adapter, portfolio, portfolioTokens, portfolioPercentages, portfolioAdapters, amount

  before('Setup Uniswap + Factory', async function() {
    accounts = await getSigners();
    tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100*(NUM_TOKENS-1)));
    WETH = tokens[0];
    uniswapFactory = await deployUniswap(accounts[0], tokens);
    [portfolioFactory, controller, , whitelist ] = await deployPlatform(accounts[0], uniswapFactory, WETH);
    [router, adapter] = await deployLoopRouter(accounts[0], controller, uniswapFactory, WETH);
    await whitelist.connect(accounts[0]).approve(router.address);
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
    const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [portfolioTokens, portfolioAdapters])
    // let duplicateTokens = portfolioTokens
    // duplicateTokens[0] = portfolioTokens[1]
    // TODO: portfolio is currently accepting duplicate tokens
    amount = ethers.BigNumber.from('10000000000000000')
    let tx = await portfolioFactory.connect(accounts[1]).createPortfolio(
      'Test Portfolio',
      'TEST',
      portfolioTokens,
      portfolioPercentages,
      false,
      0,
      REBALANCE_THRESHOLD,
      SLIPPAGE,
      TIMELOCK,
      router.address,
      data,
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

  it('Should fail to verify structure: 0 address', async function() {
    const failTokens = [AddressZero, tokens[1].address]
    const failPercentages = [500, 500]
    await expect(portfolio.verifyStructure(failTokens, failPercentages)).to.be.revertedWith('invalid weth addr')
  })

  it('Should fail to verify structure: out of order', async function() {
    const failTokens = [tokens[1].address, AddressZero]
    const failPercentages = [500, 500]
    await expect(portfolio.verifyStructure(failTokens, failPercentages)).to.be.revertedWith('token ordering')
  })

  it('Should fail to verify structure: no percentage', async function() {
    const positions = [
      {token: tokens[1].address, percentage: 1000},
      {token: tokens[2].address, percentage: 0},
    ];
    const [failTokens, failPercentages] = preparePortfolio(positions, adapter.address);
    await expect(portfolio.verifyStructure(failTokens, failPercentages)).to.be.revertedWith('bad percentage')
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

  it('Should fail to mint tokens: not controller', async function() {
    await expect(portfolio.connect(accounts[3]).mint(accounts[3].address, 1)).to.be.revertedWith('controller only')
  })

  it('Should fail to update manager: not manager', async function() {
    await expect(portfolio.connect(accounts[2]).updateManager(accounts[2].address)).to.be.revertedWith()
  })
  /*
  it('Should fail to update manager: zero address', async function() {
    await expect(portfolio.connect(accounts[1]).updateManager(AddressZero)).to.be.revertedWith()
  })
  */

	it('Should update manager', async function () {
		await portfolio.connect(accounts[1]).updateManager(accounts[2].address)
		expect(await portfolio.manager()).to.equal(accounts[2].address)
	})
	/*
  it('Should fail to renounce ownership: not owner', async function() {
    await expect(portfolio.connect(accounts[1]).renounceOwnership()).to.be.revertedWith()
  })

  it('Should renounce ownership', async function() {
    await portfolio.connect(accounts[2]).renounceOwnership()
    expect(await portfolio.owner()).to.equal(AddressZero)
  })
  */

  it('Should fail to permit: signer not owner', async function() {
    const owner = accounts[2]
    const spender = accounts[1]
    const deadline = constants.MaxUint256

    const [name, chainId, nonce] = await Promise.all([
      portfolio.name(),
      portfolio.chainId(),
      portfolio.nonces(owner.address)
    ])
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "uint256" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ]
      },
      primaryType: 'Permit',
      domain: {
        name: name,
        version: 1,
        chainId: chainId.toString(),
        verifyingContract: portfolio.address
      },
      message: {
        owner: owner.address,
        spender: spender.address,
        value: 1,
        nonce: nonce.toString(),
        deadline: deadline.toString()
      }
    }
    //Spender tries to sign transaction instead of owner
    const { v, r, s} = ethers.utils.splitSignature(await spender.provider.send('eth_signTypedData', [
      spender.address,
      typedData
    ]))

    await expect(portfolio.connect(spender).permit(owner.address, spender.address, 1, deadline, v, r, s)).to.be.revertedWith('invalid signature')
  })

  it('Should fail to permit: past deadline', async function() {
    const owner = accounts[2]
    const spender = accounts[1]
    const { v, r, s} = await preparePermit(portfolio, owner, spender, 1, 0)
    await expect(portfolio.connect(owner).permit(owner.address, spender.address, 1, 0, v, r, s)).to.be.revertedWith('expired deadline')
  })

  it('Should permit', async function() {
    amount = ethers.BigNumber.from('10000000000000000')
    const owner = accounts[2]
    const spender = accounts[1]
    const deadline = constants.MaxUint256

    const { v, r, s} = await preparePermit(portfolio, owner, spender, amount.toString(), deadline.toString())
    await portfolio.connect(owner).permit(owner.address, spender.address, amount, deadline, v, r, s)
    expect(amount.eq(await portfolio.allowance(owner.address, spender.address))).to.equal(true)
  })

  it('Should transferFrom tokens', async function() {
    portfolio.connect(accounts[1]).transferFrom(accounts[2].address, accounts[1].address, amount)
    expect(ethers.BigNumber.from(await portfolio.balanceOf(accounts[1].address)).eq(amount)).to.equal(true)
    expect(ethers.BigNumber.from(await portfolio.balanceOf(accounts[2].address)).eq(0)).to.equal(true)
  })

  it('Should fail to withdraw: no portfolio tokens', async function () {
    await expect(portfolio.connect(accounts[0]).withdraw(1))
      .to.be.revertedWith('ERC20: Amount exceeds balance')
  })

  it('Should fail to withdraw: no amount passed', async function () {
    await expect(portfolio.connect(accounts[1]).withdraw(0))
      .to.be.revertedWith('0 amount')
  })

  it('Should withdraw', async function () {
    amount = ethers.BigNumber.from('10000000000000')
    const supplyBefore = BigNumber((await portfolio.totalSupply()).toString())
    const tokenBalanceBefore = BigNumber((await tokens[1].balanceOf(portfolio.address)).toString())
    const tx = await portfolio.connect(accounts[1]).withdraw(amount)
    const receipt = await tx.wait()
    console.log('Gas Used: ', receipt.gasUsed.toString())
    const supplyAfter = BigNumber((await portfolio.totalSupply()).toString())
    const tokenBalanceAfter = BigNumber((await tokens[1].balanceOf(portfolio.address)).toString())
    expect(supplyBefore.minus(amount.toString()).isEqualTo(supplyAfter)).to.equal(true)
    expect(supplyBefore.dividedBy(supplyAfter).decimalPlaces(10).isEqualTo(tokenBalanceBefore.dividedBy(tokenBalanceAfter).decimalPlaces(10))).to.equal(true)
    expect(tokenBalanceBefore.isGreaterThan(tokenBalanceAfter)).to.equal(true)
  })
});
