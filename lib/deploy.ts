const hre = require('hardhat')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract } from 'ethers'
import { encodePriceSqrt, getDeadline, getMinTick, getMaxTick, UNI_V3_FEE } from './utils'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'
import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json'
import UniswapV2Pair from '@uniswap/v2-core/build/UniswapV2Pair.json'
import UniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import NonfungiblePositionManager from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import NonfungibleTokenPositionDescriptor from '@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json'

const { ethers, waffle } = hre
const { constants, getContractFactory } = ethers
const { WeiPerEther } = constants

export async function deployTokens(owner: SignerWithAddress, numTokens: number, value: BigNumber): Promise<Contract[]> {
	const tokens: Contract[] = []
	for (let i = 0; i < numTokens; i++) {
		if (i === 0) {
			const token = await waffle.deployContract(owner, WETH9)
			await token.deposit({ value: value })
			tokens.push(token)
		} else {
			const token = await waffle.deployContract(owner, ERC20, [WeiPerEther.mul(10000)])
			tokens.push(token)
		}
	}
	return tokens
}

export async function deployBalancer(owner: SignerWithAddress, tokens: Contract[]): Promise<[Contract, Contract]> {
	const BalancerFactory = await getContractFactory('Balancer')
	const BalancerRegistry = await getContractFactory('BalancerRegistry')
	const Pool = await getContractFactory('BPool')

	const balancerFactory = await BalancerFactory.connect(owner).deploy()
	await balancerFactory.deployed()

	const balancerRegistry = await BalancerRegistry.connect(owner).deploy(balancerFactory.address)
	await balancerRegistry.deployed()

	for (let i = 0; i < tokens.length; i++) {
		if (i !== 0) {
			const tx = await balancerFactory.newBPool()
			const receipt = await tx.wait()
			if (
				receipt.events === undefined ||
				receipt.events[0].args === undefined ||
				receipt.events[0].args.pool === undefined
			) {
				throw new Error('deployBalancer() -> Failed to find pool arg in newBPool() event')
			}
			const poolAddress = receipt.events[0].args.pool
			const pool = Pool.connect(owner).attach(poolAddress)
			await tokens[0].approve(poolAddress, WeiPerEther.mul(100))
			await tokens[i].approve(poolAddress, WeiPerEther.mul(100))
			await pool.bind(tokens[0].address, WeiPerEther.mul(100), WeiPerEther.mul(5))
			await pool.bind(tokens[i].address, WeiPerEther.mul(100), WeiPerEther.mul(5))
			await pool.finalize()
			await balancerRegistry.addPoolPair(poolAddress, tokens[0].address, tokens[i].address)
			await balancerRegistry.sortPools([tokens[0].address, tokens[i].address], BigNumber.from(3))
		}
	}
	return [balancerFactory, balancerRegistry]
}

export async function deployBalancerAdapter(owner: SignerWithAddress, balancerRegistry: Contract, weth: Contract) {
	const BalancerAdapter = await getContractFactory('BalancerAdapter')
	const adapter = await BalancerAdapter.connect(owner).deploy(balancerRegistry.address, weth.address)
	await adapter.deployed()
	return adapter
}

export async function deployUniswapV2(owner: SignerWithAddress, tokens: Contract[]): Promise<Contract> {
	const uniswapFactory = await waffle.deployContract(owner, UniswapV2Factory, [owner.address])
	await uniswapFactory.deployed()
	const liquidityAmount = WeiPerEther.mul(100)
	//console.log('Uniswap factory: ', uniswapFactory.address)
	for (let i = 1; i < tokens.length; i++) {
		//tokens[0] is used as the trading pair (WETH)
		await uniswapFactory.createPair(tokens[0].address, tokens[i].address)
		const pairAddress = await uniswapFactory.getPair(tokens[0].address, tokens[i].address)
		const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), owner)

		// Add liquidity
		await tokens[0].connect(owner).transfer(pairAddress, liquidityAmount)
		await tokens[i].connect(owner).transfer(pairAddress, liquidityAmount)
		await pair.connect(owner).mint(owner.address)
	}
	return uniswapFactory
}
// deployUniswapV3: async (owner, tokens) => {
export async function deployUniswapV3(owner: SignerWithAddress, tokens: Contract[]) {
	const uniswapFactory = await waffle.deployContract(owner, UniswapV3Factory)
	await uniswapFactory.deployed()
	const uniswapNFTDescriptor = await waffle.deployContract(owner, NonfungibleTokenPositionDescriptor, [tokens[0].address])
	const uniswapNFTManager = await waffle.deployContract(owner, NonfungiblePositionManager, [uniswapFactory.address, tokens[0].address, uniswapNFTDescriptor.address])
	await tokens[0].connect(owner).approve(uniswapNFTManager.address, constants.MaxUint256)
	for (let i = 1; i < tokens.length; i++) {
		//tokens[0] is used as the trading pair (WETH)
		await uniswapNFTManager.createAndInitializePoolIfNecessary(
	tokens[0].address,
	tokens[i].address,
	UNI_V3_FEE,
	encodePriceSqrt(1, 1)
  )
		// Add liquidity
		await tokens[i].connect(owner).approve(uniswapNFTManager.address, constants.MaxUint256)

		const aNum = ethers.BigNumber.from(tokens[0].address)
		const bNum = ethers.BigNumber.from(tokens[i].address)

		await uniswapNFTManager.mint({
	token0: aNum.lt(bNum) ? tokens[0].address : tokens[i].address,
	token1: aNum.lt(bNum) ? tokens[i].address : tokens[0].address,
	tickLower: getMinTick(60),
	tickUpper: getMaxTick(60),
	fee: UNI_V3_FEE,
	recipient: owner.address,
	amount0Desired: WeiPerEther.mul(100),
	amount1Desired: WeiPerEther.mul(100),
	amount0Min: 0,
	amount1Min: 0,
	deadline: getDeadline(240),
  })
	}
	return [uniswapFactory, uniswapNFTManager]
}

export async function deployUniswapV2Adapter(owner: SignerWithAddress, uniswapFactory: Contract, weth: Contract): Promise<Contract> {
	const UniswapAdapter = await getContractFactory('UniswapV2Adapter')
	const adapter = await UniswapAdapter.connect(owner).deploy(uniswapFactory.address, weth.address)
	await adapter.deployed()
	return adapter
}

export class Platform {
	strategyFactory: Contract
	controller: Contract
	oracle: Contract
	whitelist: Contract
	controllerAdmin: Contract
	public constructor(strategyFactory: Contract, controller: Contract, oracle: Contract, whitelist: Contract, controllerAdmin: Contract) {
		this.strategyFactory = strategyFactory
		this.controller = controller
		this.oracle = oracle
		this.whitelist = whitelist
		this.controllerAdmin = controllerAdmin
	}

	print() {
		console.log('Enso Platform: ')
		console.log('  Factory: ', this.strategyFactory.address)
		console.log('  Controller: ', this.controller.address)
		console.log('  Oracle: ', this.oracle.address)
		console.log('  Whitelist: ', this.whitelist.address)
		console.log('  ControllerAdmin: ', this.controllerAdmin.address)
	}
}
export async function deployPlatform(
	owner: SignerWithAddress,
	uniswapFactory: Contract,
	weth: Contract
): Promise<Platform> {
	const Oracle = await getContractFactory('UniswapNaiveOracle')
	const oracle = await Oracle.connect(owner).deploy(uniswapFactory.address, weth.address)
	await oracle.deployed()

	const Whitelist = await getContractFactory('Whitelist')
	const whitelist = await Whitelist.connect(owner).deploy()
	await whitelist.deployed()

	const Strategy = await getContractFactory('Strategy')
	const strategyImplementation = await Strategy.connect(owner).deploy()
	await strategyImplementation.deployed()

	const StrategyProxyFactoryAdmin = await getContractFactory('StrategyProxyFactoryAdmin')
	const factoryAdmin = await StrategyProxyFactoryAdmin.connect(owner).deploy(
		strategyImplementation.address,
		oracle.address,
		whitelist.address
	)
	await factoryAdmin.deployed()

	const factoryAddress = await factoryAdmin.factory()
	const StrategyProxyFactory = await getContractFactory('StrategyProxyFactory')
	const strategyFactory = await StrategyProxyFactory.attach(factoryAddress)

	const StrategyControllerAdmin = await getContractFactory('StrategyControllerAdmin')
	const controllerAdmin = await StrategyControllerAdmin.connect(owner).deploy(factoryAddress)
	await controllerAdmin.deployed()

	const controllerAddress = await controllerAdmin.controller()
	const StrategyController = await getContractFactory('StrategyController')
	const controller = await StrategyController.attach(controllerAddress)

	await strategyFactory.connect(owner).setController(controllerAddress)

	return new Platform(strategyFactory, controller, oracle, whitelist, controllerAdmin)
}

export async function deployLoopRouter(
	owner: SignerWithAddress,
	controller: Contract,
	adapter: Contract,
	weth: Contract
) {
	const LoopRouter = await getContractFactory('LoopRouter')
	const router = await LoopRouter.connect(owner).deploy(adapter.address, controller.address, weth.address)
	await router.deployed()

	return router
}
export async function deployGenericRouter(owner: SignerWithAddress, controller: Contract, weth: Contract) {
	const GenericRouter = await ethers.getContractFactory('GenericRouter')
	const router = await GenericRouter.connect(owner).deploy(controller.address, weth.address)
	await router.deployed()
	return router
}
