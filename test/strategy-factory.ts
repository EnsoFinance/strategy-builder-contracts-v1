import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract, BigNumber, Event } from 'ethers'
import { deployTokens, deployUniswapV2, deployUniswapV2Adapter, deployPlatform, deployLoopRouter } from '../lib/deploy'
import { prepareStrategy, StrategyItem, InitialState } from '../lib/encode'
import { DEFAULT_DEPOSIT_SLIPPAGE } from '../lib/constants'
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
const { constants, getContractFactory, getSigners } = ethers
const { AddressZero, MaxUint256, WeiPerEther } = constants

const chai = require('chai')
import { solidity } from 'ethereum-waffle'
chai.use(solidity)

const NUM_TOKENS = 15

describe('StrategyProxyFactory', function () {
		let tokens: Contract[],
		weth: Contract,
		accounts: SignerWithAddress[],
		uniswapFactory: Contract,
		router: Contract,
		strategyFactory: Contract,
		newFactory: Contract,
		controller: Contract,
		oracle: Contract,
		newOracle: Contract,
		newWhitelist: Contract,
		whitelist: Contract,
		library: Contract,
		adapter: Contract,
		newRouter: Contract,
		strategy: Contract,
		strategyItems: StrategyItem[],
		newImplementationAddress: string

	before('Setup Uniswap + Factory', async function () {
		accounts = await getSigners()
		tokens = await deployTokens(accounts[10], NUM_TOKENS, WeiPerEther.mul(100 * (NUM_TOKENS - 1)))
		weth = tokens[0]
		uniswapFactory = await deployUniswapV2(accounts[10], tokens)
		const platform = await deployPlatform(accounts[10], uniswapFactory, new Contract(AddressZero, [], accounts[10]), weth)
		controller = platform.controller
		strategyFactory = platform.strategyFactory
		oracle = platform.oracles.ensoOracle
		whitelist = platform.administration.whitelist
		library = platform.library
		adapter = await deployUniswapV2Adapter(accounts[10], uniswapFactory, weth)
		await whitelist.connect(accounts[10]).approve(adapter.address)
		router = await deployLoopRouter(accounts[10], controller, library)
		await whitelist.connect(accounts[10]).approve(router.address)
	})

	before('Setup new implementation, oracle, whitelist', async function () {
		const platform = await deployPlatform(accounts[10], uniswapFactory, new Contract(AddressZero, [], accounts[10]), weth)
		newFactory = platform.strategyFactory
		newOracle = platform.oracles.ensoOracle
		newWhitelist = platform.administration.whitelist
		newRouter = await deployLoopRouter(accounts[10], controller, library)
		await newWhitelist.connect(accounts[10]).approve(adapter.address)
		await newWhitelist.connect(accounts[10]).approve(newRouter.address)
		newImplementationAddress = await newFactory.implementation()
	})

	before('Should deploy strategy', async function () {
		const positions = [
			{ token: tokens[1].address, percentage: BigNumber.from(500) },
			{ token: tokens[2].address, percentage: BigNumber.from(500) },
		]
		strategyItems = prepareStrategy(positions, adapter.address)
		const strategyState: InitialState = {
			timelock: BigNumber.from(60),
			rebalanceThreshold: BigNumber.from(10),
			rebalanceSlippage: BigNumber.from(997),
			restructureSlippage: BigNumber.from(995),
			performanceFee: BigNumber.from(0),
			social: false,
			set: false
		}

		const amount = ethers.BigNumber.from('10000000000000000')
		const Strategy = await getContractFactory('Strategy')

		let tx = await strategyFactory
			.connect(accounts[1])
			.createStrategy(
				accounts[1].address,
				'Test Strategy',
				'TEST',
				strategyItems,
				strategyState,
				router.address,
				'0x',
				{ value: amount }
			)
		let receipt = await tx.wait()
		const strategyAddress = receipt.events.find((ev: Event) => ev.event === 'NewStrategy').args.strategy
		strategy = Strategy.attach(strategyAddress)
	})

	it('Should check controller value', async function () {
		expect(await strategyFactory.controller()).to.equal(controller.address)
	})

	it('Should fail to update oracle: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).updateOracle(newOracle.address)).to.be.revertedWith(
			'Not owner'
		)
	})

	it('Should update oracle', async function () {
		expect(await controller.oracle()).to.equal(oracle.address)
		await strategyFactory.connect(accounts[10]).updateOracle(newOracle.address)
		expect(await strategyFactory.oracle()).to.equal(newOracle.address)
		expect(await controller.oracle()).to.equal(oracle.address)
		await controller.updateAddresses()
		expect(await controller.oracle()).to.equal(newOracle.address)
	})

	it('Should fail to update whitelist: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).updateWhitelist(newWhitelist.address)).to.be.revertedWith(
			'Not owner'
		)
	})

	it('Should update whitelist', async function () {
		const oldBalance = await strategy.balanceOf(accounts[1].address)
		await expect(
			controller.connect(accounts[1]).deposit(strategy.address, newRouter.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', {
				value: ethers.BigNumber.from('10000000000000000'),
			})
		).to.be.revertedWith('Not approved')
		await strategyFactory.connect(accounts[10]).updateWhitelist(newWhitelist.address)
		expect(await strategyFactory.whitelist()).to.equal(newWhitelist.address)
		await controller.updateAddresses()
		await controller
			.connect(accounts[1])
			.deposit(strategy.address, newRouter.address, 0, DEFAULT_DEPOSIT_SLIPPAGE, '0x', { value: ethers.BigNumber.from('10000000000000000') })
		const newBalance = await strategy.balanceOf(accounts[1].address)
		expect(ethers.BigNumber.from(newBalance).gt(oldBalance)).to.equal(true)
	})

	it('Should fail to update pool: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).updatePool(accounts[1].address)).to.be.revertedWith(
			'Not owner'
		)
	})

	it('Should update pool', async function () {
		await strategyFactory.connect(accounts[10]).updatePool(accounts[0].address)
		expect(await strategyFactory.pool()).to.equal(accounts[0].address)
	})

	it('Should fail to add item: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).addItemToRegistry(0, 0, tokens[1].address)).to.be.revertedWith('Not owner')
	})

	it('Should fail to add item: invalid category', async function () {
		await expect(strategyFactory.connect(accounts[10]).addItemToRegistry(0, 100, tokens[1].address)).to.be.revertedWith('Invalid category')
	})

	it('Should fail to update implementation: not owner', async function () {
		await expect(
			strategyFactory.connect(accounts[1]).updateImplementation(newImplementationAddress, '2')
		).to.be.revertedWith('Not owner')
	})

	it('Should fail to update implementation to 1', async function () {
		await expect(
			strategyFactory.connect(accounts[10]).updateImplementation(newImplementationAddress, '1')
		).to.be.revertedWith('Invalid version')
	})

	it('Should fail to update implementation to 0', async function () {
		await expect(
			strategyFactory.connect(accounts[10]).updateImplementation(newImplementationAddress, '0')
		).to.be.revertedWith('Invalid version')
	})

	it('Should fail to update minor version 2.1', async function () {
		await expect(
			strategyFactory.connect(accounts[10]).updateImplementation(newImplementationAddress, '2.1')
		).to.be.revertedWith('Invalid string integer')
	})

	it('Should fail to update proxy version: not admin', async function () {
		await expect(
			strategyFactory.connect(accounts[1]).updateProxyVersion(strategy.address)
		).to.be.revertedWith('Only admin')
	})

	it('Should fail to transfer ownership: not owner', async function () {
		await expect(strategyFactory.connect(accounts[2]).transferOwnership(accounts[2].address)).to.be.revertedWith(
			'Not owner'
		)
	})

	it('Should fail to transfer ownership: zero address', async function() {
		await expect(strategyFactory.connect(accounts[10]).transferOwnership(AddressZero)).to.be.revertedWith('Zero address provided')
	})

	it('Should transfer ownership', async function () {
		await strategyFactory.connect(accounts[10]).transferOwnership(accounts[2].address)
		expect(await strategyFactory.owner()).to.equal(accounts[2].address)
	})

	it('Should fail to renounce ownership: not owner', async function () {
		await expect(strategyFactory.connect(accounts[1]).renounceOwnership()).to.be.revertedWith('Not owner')
	})

  it('Should be initialized', async function () {
    // tl;dr if __gap isn't used, any additional entries to put in `StrategyTokenStorage`
    // will make it so that an upgrade to this `OtherStrategy` will put the "initialized"
    // storage variables in different slots, so that they will have "0" value ->> false
    // meaning that an attacker can "back-run" an `updateImplementation` call with
    // an `initialize` call to the `strategy` with their own parameters, specifically
    // a "manager" address in their control.
    const OtherStrategy = await getContractFactory('OtherStrategy')
    let someAddress = accounts[8].address;
    let otherStrategy = await OtherStrategy.deploy(strategyFactory.address, someAddress, someAddress, someAddress);

    await strategyFactory.connect(accounts[2]).updateImplementation(otherStrategy.address, '2');
    let admin = await strategyFactory.admin();
    const StrategyAdmin = await getContractFactory('StrategyProxyAdmin')
    let strategyAdmin = await StrategyAdmin.attach(admin)
    await strategyAdmin.connect(accounts[1]).upgrade(strategy.address);

    // now call initialize
    let someMaliciousAddress = someAddress;
    await expect(
      strategy.initialize("anyName", "anySymbol", "anyVersion", someMaliciousAddress, [])
    ).to.be.revertedWith("Initializable: contract is already initialized");
  })

	it('Should update implementation to version uint256.max()', async function () {
		/*const version = await strategyFactory.version(); // TODO update this part of test
		expect(await strategy.version()).to.eq(version);
    */

		await strategyFactory.connect(accounts[2]).updateImplementation(newImplementationAddress, MaxUint256.toString())
		expect(await strategyFactory.implementation()).to.equal(newImplementationAddress)
		expect(ethers.BigNumber.from(await strategyFactory.version()).eq(MaxUint256.toString())).to.equal(true)
	})

	it('Should transfer ownership', async function () {
		await strategyFactory.connect(accounts[2]).renounceOwnership()
		expect(await strategyFactory.owner()).to.equal(AddressZero)
	})

})
