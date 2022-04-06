import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
const { expect } = require('chai')

const { ethers, waffle } = require('hardhat')
// import { BigNumber as BN } from 'bignumber.js'
const bn = require('bignumber.js')
import { Contract, BigNumber } from 'ethers'
const { deployContract, provider } = waffle
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther, MaxUint256 } = constants
const { deployTokens, deployUniswapV3 } = require('../lib/deploy')
const { encodePath } = require('../lib/encode')
const { encodePriceSqrt, getMaxTick, getMinTick, increaseTime, getDeadline } = require('../lib/utils')
const {  UNI_V3_FEE } = require('../lib/constants')

const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
const UniswapV3Pool = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json')
const SwapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')

const NUM_TOKENS = 3
const ORACLE_TIME_WINDOW = 1
const HIGH_FEE = 10000

let tokens: Contract[],
		weth: Contract,
		nonWethPair: Contract,
		accounts: SignerWithAddress[],
		oracle: Contract,
		registry: Contract,
		uniswapV3Factory: Contract,
		uniswapNFTManager: Contract,
		uniswapRouter: Contract,
		trader: SignerWithAddress

async function exactInput(
  tokens: string[],
  amountIn: number,
  amountOutMinimum: number
) {
  const inputIsWETH = weth.address === tokens[0]
  const outputIsWETH = tokens[tokens.length - 1] === weth.address

  const value = inputIsWETH ? amountIn : 0

  const params = {
    path: encodePath(tokens, new Array(tokens.length - 1).fill(UNI_V3_FEE)),
    recipient: outputIsWETH ? uniswapRouter.address : trader.address,
    deadline: await getDeadline(100000),
    amountIn,
    amountOutMinimum,
  }

  const data = [uniswapRouter.interface.encodeFunctionData('exactInput', [params])]
  if (outputIsWETH)
    data.push(uniswapRouter.interface.encodeFunctionData('unwrapWETH9', [amountOutMinimum, trader.address]))

  // optimized for the gas test
  return data.length === 1
    ? uniswapRouter.connect(trader).exactInput(params, { value })
    : uniswapRouter.connect(trader).multicall(data, { value })
}

async function calcTWAP(amount: number, input: string): Promise<typeof bn> {
	const poolAddress = await uniswapV3Factory.getPool(weth.address, input, UNI_V3_FEE)
	const pool = new Contract(poolAddress, JSON.stringify(UniswapV3Pool.abi), provider)
	const [tickCumulatives, ] = await pool.observe([ORACLE_TIME_WINDOW, 0])
	const tick = bn(tickCumulatives[1].toString()).minus(tickCumulatives[0].toString()).dividedBy(ORACLE_TIME_WINDOW)

	const aNum = ethers.BigNumber.from(weth.address)
	const bNum = ethers.BigNumber.from(input)

	if (aNum.lt(bNum)) {
		return bn(amount.toString()).dividedBy(bn(1.0001).exponentiatedBy(tick)).toFixed(0, 1)
	} else {
		return bn(amount.toString()).multipliedBy(bn(1.0001).exponentiatedBy(tick)).toFixed(0, 1)
	}
}

describe('UniswapV3Oracle', function() {
	before('Setup Uniswap V3 + Oracle', async function() {
		accounts = await getSigners()
		trader = accounts[7]
		// Need to deploy these tokens before WETH to get the correct arrangement of token address where some are bigger and some smaller (for sorting)
		const token1 = await deployContract(trader, ERC20, [WeiPerEther.mul(10000)])
		const token2 = await deployContract(trader, ERC20, [WeiPerEther.mul(10000)])
		tokens = await deployTokens(trader, NUM_TOKENS-2, WeiPerEther.mul(100).mul(NUM_TOKENS - 1))
		tokens.push(token1)
		tokens.push(token2)
		weth = tokens[0]
		;[uniswapV3Factory, uniswapNFTManager] = await deployUniswapV3(trader, tokens)
		uniswapRouter = await deployContract(trader, SwapRouter, [uniswapV3Factory.address, weth.address])
		nonWethPair = await deployContract(trader, ERC20, [WeiPerEther.mul(10000)])
		// Create non weth pool
		const aNum = ethers.BigNumber.from(tokens[2].address)
		const bNum = ethers.BigNumber.from(nonWethPair.address)
		const flipper = aNum.lt(bNum)
		await uniswapNFTManager.createAndInitializePoolIfNecessary(
			flipper ? tokens[2].address : nonWethPair.address,
			flipper ? nonWethPair.address : tokens[2].address,
			HIGH_FEE,
			encodePriceSqrt(1, 1)
		)
		// Add liquidity
		await nonWethPair.connect(trader).approve(uniswapNFTManager.address, MaxUint256)
		await uniswapNFTManager.connect(trader).mint({
			token0: flipper ? tokens[2].address : nonWethPair.address,
			token1: flipper ? nonWethPair.address : tokens[2].address,
			tickLower: getMinTick(200),
			tickUpper: getMaxTick(200),
			fee: HIGH_FEE,
			recipient: trader.address,
			amount0Desired: WeiPerEther, //Lower liquidity
			amount1Desired: WeiPerEther, //Lower liquidity
			amount0Min: 0,
			amount1Min: 0,
			deadline: getDeadline(240),
		})

		const Registry = await getContractFactory('UniswapV3Registry')
		registry = await Registry.connect(trader).deploy(ORACLE_TIME_WINDOW, uniswapV3Factory.address, weth.address)
		await registry.deployed()
		const Oracle = await getContractFactory('UniswapV3Oracle')
		oracle = await Oracle.connect(trader).deploy(registry.address, weth.address)
		await oracle.deployed()
	})

	it('Should add pool', async function() {
		await registry.addPool(tokens[1].address, weth.address, UNI_V3_FEE)
		const { pool } = await registry.getPoolData(tokens[1].address)
		expect(pool).to.not.equal(AddressZero)
		expect(pool).to.equal(await uniswapV3Factory.getPool(tokens[1].address, weth.address, UNI_V3_FEE))
	})

	it('Should get empty pool', async function() {
		await expect(registry.getPoolData(tokens[2].address)).to.be.revertedWith('Pool not found')
	})

	it('Should fail to add pool: not owner', async function() {
		await expect(registry.connect(accounts[1]).addPool(tokens[2].address, weth.address, UNI_V3_FEE)).to.be.revertedWith('Ownable: caller is not the owner')
	})

	it('Should batch add pools', async function() {
		const poolTokens = tokens.slice(1,).map((token) => token.address)
		const pairTokens = Array(poolTokens.length).fill(weth.address)
		const fees = Array(poolTokens.length).fill(UNI_V3_FEE)
		await registry.batchAddPools(poolTokens, pairTokens, fees)
	})

	it('Should fail to add pool: not valid', async function() {
		await expect(registry.addPool(AddressZero, weth.address, UNI_V3_FEE)).to.be.revertedWith('Not valid pool')
	})

	it('Should swap on uniswap', async function() {
		await exactInput([weth.address, tokens[1].address], WeiPerEther, 0)
		await increaseTime(60)

		await exactInput([weth.address, tokens[1].address], WeiPerEther, 0)
		await increaseTime(60)
	})

	it('Should consult oracle: weth', async function() {
		const amount = WeiPerEther
		expect((await oracle.consult(amount, weth.address)).eq(amount)).to.equal(true)
	})

	it('Should consult oracle: no amount', async function() {
		const amount = 0
		expect((await oracle.consult(amount, AddressZero)).eq(amount)).to.equal(true)
	})

	it('Should consult oracle: no amount', async function() {
		const amount = 0
		expect((await oracle.consult(amount, nonWethPair.address)).eq(amount)).to.equal(true)
	})

	it('Add non weth pool', async function() {
		await registry.addPool(nonWethPair.address, tokens[2].address, HIGH_FEE)
		const { pool } = await registry.getPoolData(tokens[1].address)
		expect(pool).to.not.equal(AddressZero)
	})

	it('Should consult oracle: non weth pair', async function() {
		// nonWethPair and token2 should have the same price
		const token2Price = await oracle.consult(WeiPerEther, tokens[2].address)
		const nonWethPairPrice = await oracle.consult(WeiPerEther, nonWethPair.address)
		expect(nonWethPairPrice).to.equal(token2Price);
	})

	it('Should consult oracle: token 1', async function() {
		const price = await oracle.consult(WeiPerEther, tokens[1].address)
		const estimate = await calcTWAP(WeiPerEther, tokens[1].address)
		expect(price.eq(estimate)).to.equal(true)
	})

	it('Should consult oracle: token 2', async function() {
		const price = await oracle.consult(WeiPerEther, tokens[2].address)
		const estimate = await calcTWAP(WeiPerEther, tokens[2].address)
		expect(price.eq(estimate)).to.equal(true)
	})

	it('Should estimate total', async function() {
		const [total, estimates] = await oracle.connect(accounts[1]).estimateTotal(accounts[0].address, [AddressZero, weth.address, tokens[1].address])
		expect((await provider.getBalance(accounts[0].address)).eq(estimates[0])).to.equal(true)
		expect((await weth.balanceOf(accounts[0].address)).eq(estimates[1])).to.equal(true)
		expect((await oracle.consult(await tokens[1].balanceOf(accounts[0].address), tokens[1].address)).eq(estimates[2])).to.equal(true)
		expect(estimates.reduce((a: BigNumber,b: BigNumber) => a.add(b)).eq(total)).to.equal(true)
	})
})
