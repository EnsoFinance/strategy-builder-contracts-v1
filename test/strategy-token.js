const BigNumber = require('bignumber.js')
const { expect } = require('chai')
const { ethers } = require('hardhat')
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, WeiPerEther } = constants
const { deployTokens, deployUniswap, deployPlatform, deployLoopRouter } = require('./helpers/deploy.js')
const { prepareStrategy, preparePermit } = require('./helpers/encode.js')

const NUM_TOKENS = 15
const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute
let WETH

describe('StrategyToken', function () {
	let tokens,
		accounts,
		uniswapFactory,
		strategyFactory,
		controller,
		whitelist,
		router,
		adapter,
		strategy,
		strategyTokens,
		strategyPercentages,
		strategyAdapters,
		amount

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[0], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		WETH = tokens[0]
		uniswapFactory = await deployUniswap(accounts[0], tokens)
		;[strategyFactory, controller, , whitelist] = await deployPlatform(accounts[0], uniswapFactory, WETH)
		;[router, adapter] = await deployLoopRouter(accounts[0], controller, uniswapFactory, WETH)
		await whitelist.connect(accounts[0]).approve(router.address)
	})

	it('Should deploy strategy', async function () {
		console.log('Strategy factory: ', strategyFactory.address)
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
		]
		;[strategyTokens, strategyPercentages, strategyAdapters] = prepareStrategy(positions, adapter.address)
		const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
		// let duplicateTokens = strategyTokens
		// duplicateTokens[0] = strategyTokens[1]
		// TODO: strategy is currently accepting duplicate tokens
		amount = ethers.BigNumber.from('10000000000000000')
		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				'Test Strategy',
				'TEST',
				strategyTokens,
				strategyPercentages,
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

		const strategyAddress = receipt.events.find((ev) => ev.event === 'NewStrategy').args.strategy
		const Strategy = await getContractFactory('Strategy')
		strategy = Strategy.attach(strategyAddress)

		expect(ethers.BigNumber.from(await strategy.totalSupply()).eq(amount)).to.equal(true)
		expect(ethers.BigNumber.from(await strategy.balanceOf(accounts[1].address)).eq(amount)).to.equal(true)
	})

	it('Should fail to verify structure: 0 address', async function () {
		const failTokens = [AddressZero, tokens[1].address]
		const failPercentages = [500, 500]
		await expect(strategy.verifyStructure(failTokens, failPercentages)).to.be.revertedWith('invalid item addr')
	})

	it('Should fail to verify structure: out of order', async function () {
		const failTokens = [tokens[1].address, AddressZero]
		const failPercentages = [500, 500]
		await expect(strategy.verifyStructure(failTokens, failPercentages)).to.be.revertedWith('item ordering')
	})

	it('Should fail to verify structure: no percentage', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: 1000 },
			{ token: tokens[2].address, percentage: 0 },
		]
		const [failTokens, failPercentages] = prepareStrategy(positions, adapter.address)
		await expect(strategy.verifyStructure(failTokens, failPercentages)).to.be.revertedWith('0 percentage provided')
	})

	it('Should get name', async function () {
		expect(await strategy.name()).to.equal('Test Strategy')
	})

	it('Should get symbol', async function () {
		expect(await strategy.symbol()).to.equal('TEST')
	})

	it('Should get decimals', async function () {
		expect(ethers.BigNumber.from(await strategy.decimals()).toString()).to.equal('18')
	})

	it('Should fail to transfer tokens: insufficient funds', async function () {
		const tooMuch = amount.mul(2)
		await expect(strategy.connect(accounts[1]).transfer(accounts[2].address, tooMuch)).to.be.revertedWith()
	})

	it('Should fail to transfer tokens: zero recipient', async function () {
		await expect(strategy.connect(accounts[1]).transfer(AddressZero, amount)).to.be.revertedWith()
	})

	it('Should transfer tokens', async function () {
		amount = amount.div(2)
		await strategy.connect(accounts[1]).transfer(accounts[2].address, amount)
		expect(ethers.BigNumber.from(await strategy.balanceOf(accounts[2].address)).eq(amount)).to.equal(true)
	})

	it('Should fail to approve tokens: zero spender', async function () {
		await expect(strategy.connect(accounts[1]).approve(AddressZero, amount)).to.be.revertedWith()
	})

	it('Should approve tokens', async function () {
		await strategy.connect(accounts[1]).approve(accounts[2].address, amount)
		expect(
			ethers.BigNumber.from(await strategy.allowance(accounts[1].address, accounts[2].address)).eq(amount)
		).to.equal(true)
	})

	it('Should fail to transferFrom tokens: zero spender', async function () {
		await expect(
			strategy.connect(accounts[2]).transferFrom(AddressZero, accounts[2].address, amount)
		).to.be.revertedWith()
	})

	it('Should fail to transferFrom tokens: zero recipient', async function () {
		await expect(
			strategy.connect(accounts[2]).transferFrom(accounts[1].address, AddressZero, amount)
		).to.be.revertedWith()
	})

	it('Should transferFrom tokens', async function () {
		strategy.connect(accounts[2]).transferFrom(accounts[1].address, accounts[2].address, amount)
		expect(ethers.BigNumber.from(await strategy.balanceOf(accounts[2].address)).eq(amount.mul(2))).to.equal(true)
		expect(ethers.BigNumber.from(await strategy.balanceOf(accounts[1].address)).eq(0)).to.equal(true)
	})

	it('Should fail to mint tokens: not controller', async function () {
		await expect(strategy.connect(accounts[3]).mint(accounts[3].address, 1)).to.be.revertedWith('controller only')
	})

	it('Should fail to update manager: not manager', async function () {
		await expect(strategy.connect(accounts[2]).updateManager(accounts[2].address)).to.be.revertedWith()
	})
	/*
  it('Should fail to update manager: zero address', async function() {
    await expect(strategy.connect(accounts[1]).updateManager(AddressZero)).to.be.revertedWith()
  })
  */

	it('Should update manager', async function () {
		await strategy.connect(accounts[1]).updateManager(accounts[2].address)
		expect(await strategy.manager()).to.equal(accounts[2].address)
	})
	/*
  it('Should fail to renounce ownership: not owner', async function() {
    await expect(strategy.connect(accounts[1]).renounceOwnership()).to.be.revertedWith()
  })

  it('Should renounce ownership', async function() {
    await strategy.connect(accounts[2]).renounceOwnership()
    expect(await strategy.owner()).to.equal(AddressZero)
  })
  */

	it('Should fail to permit: signer not owner', async function () {
		const owner = accounts[2]
		const spender = accounts[1]
		const deadline = constants.MaxUint256

		const [name, chainId, nonce] = await Promise.all([
			strategy.name(),
			strategy.chainId(),
			strategy.nonces(owner.address),
		])
		const typedData = {
			types: {
				EIP712Domain: [
					{ name: 'name', type: 'string' },
					{ name: 'version', type: 'uint256' },
					{ name: 'chainId', type: 'uint256' },
					{ name: 'verifyingContract', type: 'address' },
				],
				Permit: [
					{ name: 'owner', type: 'address' },
					{ name: 'spender', type: 'address' },
					{ name: 'value', type: 'uint256' },
					{ name: 'nonce', type: 'uint256' },
					{ name: 'deadline', type: 'uint256' },
				],
			},
			primaryType: 'Permit',
			domain: {
				name: name,
				version: 1,
				chainId: chainId.toString(),
				verifyingContract: strategy.address,
			},
			message: {
				owner: owner.address,
				spender: spender.address,
				value: 1,
				nonce: nonce.toString(),
				deadline: deadline.toString(),
			},
		}
		//Spender tries to sign transaction instead of owner
		const { v, r, s } = ethers.utils.splitSignature(
			await spender.provider.send('eth_signTypedData', [spender.address, typedData])
		)

		await expect(
			strategy.connect(spender).permit(owner.address, spender.address, 1, deadline, v, r, s)
		).to.be.revertedWith('invalid signature')
	})

	it('Should fail to permit: past deadline', async function () {
		const owner = accounts[2]
		const spender = accounts[1]
		const { v, r, s } = await preparePermit(strategy, owner, spender, 1, 0)
		await expect(strategy.connect(owner).permit(owner.address, spender.address, 1, 0, v, r, s)).to.be.revertedWith(
			'expired deadline'
		)
	})

	it('Should permit', async function () {
		amount = ethers.BigNumber.from('10000000000000000')
		const owner = accounts[2]
		const spender = accounts[1]
		const deadline = constants.MaxUint256

		const { v, r, s } = await preparePermit(strategy, owner, spender, amount.toString(), deadline.toString())
		await strategy.connect(owner).permit(owner.address, spender.address, amount, deadline, v, r, s)
		expect(amount.eq(await strategy.allowance(owner.address, spender.address))).to.equal(true)
	})

	it('Should transferFrom tokens', async function () {
		strategy.connect(accounts[1]).transferFrom(accounts[2].address, accounts[1].address, amount)
		expect(ethers.BigNumber.from(await strategy.balanceOf(accounts[1].address)).eq(amount)).to.equal(true)
		expect(ethers.BigNumber.from(await strategy.balanceOf(accounts[2].address)).eq(0)).to.equal(true)
	})

	it('Should fail to withdraw: no strategy tokens', async function () {
		await expect(strategy.connect(accounts[0]).withdraw(1)).to.be.revertedWith('ERC20: Amount exceeds balance')
	})

	it('Should fail to withdraw: no amount passed', async function () {
		await expect(strategy.connect(accounts[1]).withdraw(0)).to.be.revertedWith('0 amount')
	})

	it('Should withdraw', async function () {
		amount = ethers.BigNumber.from('10000000000000')
		const supplyBefore = BigNumber((await strategy.totalSupply()).toString())
		const tokenBalanceBefore = BigNumber((await tokens[1].balanceOf(strategy.address)).toString())
		const tx = await strategy.connect(accounts[1]).withdraw(amount)
		const receipt = await tx.wait()
		console.log('Gas Used: ', receipt.gasUsed.toString())
		const supplyAfter = BigNumber((await strategy.totalSupply()).toString())
		const tokenBalanceAfter = BigNumber((await tokens[1].balanceOf(strategy.address)).toString())
		expect(supplyBefore.minus(amount.toString()).isEqualTo(supplyAfter)).to.equal(true)
		expect(
			supplyBefore
				.dividedBy(supplyAfter)
				.decimalPlaces(10)
				.isEqualTo(tokenBalanceBefore.dividedBy(tokenBalanceAfter).decimalPlaces(10))
		).to.equal(true)
		expect(tokenBalanceBefore.isGreaterThan(tokenBalanceAfter)).to.equal(true)
	})
})
