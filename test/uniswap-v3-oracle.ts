import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
const { expect } = require('chai')

const { ethers, waffle } = require('hardhat')
// import { BigNumber as BN } from 'bignumber.js'
const bn = require('bignumber.js')
import { Contract, BigNumber } from 'ethers'
const { deployContract, provider } = waffle
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
const { deployTokens, deployUniswapV3 } = require('../lib/deploy')
const { encodePath } = require('../lib/encode')
const { encodePriceSqrt, getMaxTick, getMinTick, increaseTime, getDeadline, UNI_V3_FEE } = require('../lib/utils')
const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
const UniswapV3Pool = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json')
const SwapRouter = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')

const NUM_TOKENS = 3
const ORACLE_TIME_WINDOW = 1

let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		oracle: Contract,
		registry: Contract,
		uniswapFactory: Contract,
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
	const poolAddress = await uniswapFactory.getPool(weth.address, input, UNI_V3_FEE)
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

		;[uniswapFactory, uniswapNFTManager] = await deployUniswapV3(trader, tokens)
		uniswapRouter = await deployContract(trader, SwapRouter, [uniswapFactory.address, weth.address])
		//uniswapQuoter = await deployContract(trader, Quoter, [uniswapFactory.address, weth.address])

		// Create second pool
		const highFee = 10000
		await uniswapNFTManager.createAndInitializePoolIfNecessary(
			tokens[0].address,
			tokens[1].address,
			highFee,
			encodePriceSqrt(1, 1)
		)
		// Add liquidity
		await tokens[0].connect(trader).deposit({ value: WeiPerEther })
		const aNum = ethers.BigNumber.from(tokens[0].address)
		const bNum = ethers.BigNumber.from(tokens[1].address)
		await uniswapNFTManager.connect(trader).mint({
			token0: aNum.lt(bNum) ? tokens[0].address : tokens[1].address,
			token1: aNum.lt(bNum) ? tokens[1].address : tokens[0].address,
			tickLower: getMinTick(200),
			tickUpper: getMaxTick(200),
			fee: highFee,
			recipient: trader.address,
			amount0Desired: WeiPerEther, //Lower liquidity
			amount1Desired: WeiPerEther, //Lower liquidity
			amount0Min: 0,
			amount1Min: 0,
			deadline: getDeadline(240),
		})

		const Registry = await getContractFactory('UniswapV3Registry')
		registry = await Registry.connect(trader).deploy(ORACLE_TIME_WINDOW, uniswapFactory.address, weth.address)
		await registry.deployed()
		const Oracle = await getContractFactory('UniswapV3Oracle')
		oracle = await Oracle.connect(trader).deploy(registry.address)
		await oracle.deployed()
	})

	it('Should initialize token', async function() {
		await registry.initialize(tokens[1].address)
		const pool = await registry.pools(tokens[1].address)
		expect(pool).to.not.equal(AddressZero)
		expect(pool).to.equal(await uniswapFactory.getPool(tokens[1].address, weth.address, UNI_V3_FEE))
	})

	it('Should initialize all tokens', async function() {
		for (let i = 1; i < tokens.length; i++) {
			await registry.initialize(tokens[i].address)
		}
	})

	it('Should fail to initialize token: not valid', async function() {
		await expect(registry.initialize(AddressZero)).to.be.revertedWith('No valid pool')
	})

	it('Should fail to add fee tier: already added', async function() {
		await expect(registry.addFee(500)).to.be.revertedWith('Fee already set')
	})

	it('Should fail to add fee tier: not owner', async function() {
		await expect(registry.connect(accounts[1]).addFee(1)).to.be.revertedWith('Ownable: caller is not the owner')
	})

	it('Should add fee tier', async function() {
		const fee = 1
		await registry.addFee(fee)
		const newFee = await registry.fees(3) //index of most recent push
		expect(newFee).to.equal(fee)
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
