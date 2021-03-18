const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
const WETH9 = require('@uniswap/v2-periphery/build/WETH9.json')
const UniswapV2Factory = require('@uniswap/v2-core/build/UniswapV2Factory.json')
const UniswapV2Pair = require('@uniswap/v2-core/build/UniswapV2Pair.json')
const { ethers, waffle } = require('hardhat')
const { deployContract, provider } = waffle
const { constants, Contract, getContractFactory } = ethers
const { WeiPerEther } = constants

module.exports = {
	deployTokens: async (owner, numTokens, value) => {
		const tokens = []
		for (let i = 0; i < numTokens; i++) {
			if (i === 0) {
				const token = await deployContract(owner, WETH9)
				token.deposit({ value: value })
				tokens.push(token)
				//console.log("Weth: ", token.address)
			} else {
				const token = await deployContract(owner, ERC20, [WeiPerEther.mul(10000)])
				tokens.push(token)
			}
		}
		return tokens
	},
	deployBalancer: async (owner, tokens) => {
			const Balancer = await getContractFactory('Balancer')
			const BalancerRegistry = await getContractFactory('BalancerRegistry')
			const Pool = await getContractFactory('BPool')

			const balancerFactory = await Balancer.connect(owner).deploy()
			await balancerFactory.deployed()

			const balancerRegistry = await BalancerRegistry.connect(owner).deploy(balancerFactory.address)
			await balancerRegistry.deployed()

			for (let i = 0; i < tokens.length; i++) {
				if (i !== 0) {
					const tx = await balancerFactory.newBPool()
					const receipt = await tx.wait()
					const poolAddress = receipt.events[0].args.pool
					const pool = await Pool.attach(poolAddress)
					await tokens[0].approve(poolAddress, WeiPerEther.mul(100))
					await tokens[i].approve(poolAddress, WeiPerEther.mul(100))
					await pool.bind(tokens[0].address, WeiPerEther.mul(100), WeiPerEther.mul(5))
					await pool.bind(tokens[i].address, WeiPerEther.mul(100), WeiPerEther.mul(5))
					await pool.finalize()
					await balancerRegistry.addPoolPair(poolAddress, tokens[0].address, tokens[i].address)
					await balancerRegistry.sortPools([tokens[0].address, tokens[i].address], 3);
				}
			}
			return [balancerFactory, balancerRegistry]
	},
	deployBalancerAdapter: async (owner, balancerRegistry, weth) => {
		const BalancerAdapter = await getContractFactory('BalancerAdapter')
		const adapter = await BalancerAdapter.connect(owner).deploy(balancerRegistry.address, weth.address)
		await adapter.deployed()
		//console.log('Uniswap adapter: ', adapter.address)
		return adapter
	},
	deployUniswap: async (owner, tokens) => {
		const uniswapFactory = await deployContract(owner, UniswapV2Factory, [owner.address])
		await uniswapFactory.deployed()
		//console.log('Uniswap factory: ', uniswapFactory.address)
		for (let i = 1; i < tokens.length; i++) {
			//tokens[0] is used as the trading pair (WETH)
			await uniswapFactory.createPair(tokens[0].address, tokens[i].address)
			const pairAddress = await uniswapFactory.getPair(tokens[0].address, tokens[i].address)
			const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), provider)
			// Add liquidity
			await tokens[0].connect(owner).transfer(pairAddress, WeiPerEther.mul(100))
			await tokens[i].connect(owner).transfer(pairAddress, WeiPerEther.mul(100))
			await pair.connect(owner).mint(owner.address)
		}
		return uniswapFactory
	},
	deployUniswapAdapter: async (owner, uniswapFactory, weth) => {
		const UniswapAdapter = await getContractFactory('UniswapAdapter')
		const adapter = await UniswapAdapter.connect(owner).deploy(uniswapFactory.address, weth.address)
		await adapter.deployed()
		//console.log('Uniswap adapter: ', adapter.address)
		return adapter
	},
	deployPlatform: async (owner, uniswapFactory, weth) => {
		const Oracle = await getContractFactory('UniswapNaiveOracle')
		const oracle = await Oracle.connect(owner).deploy(uniswapFactory.address, weth.address)
		await oracle.deployed()

		const Whitelist = await getContractFactory('TestWhitelist')
		const whitelist = await Whitelist.connect(owner).deploy()
		await whitelist.deployed()

		const StrategyControllerAdmin = await getContractFactory('StrategyControllerAdmin')
		const controllerAdmin = await StrategyControllerAdmin.connect(owner).deploy()
		await controllerAdmin.deployed()

		const controllerAddress = await controllerAdmin.controller()
		const StrategyController = await getContractFactory('StrategyController')
		const controller = await StrategyController.attach(controllerAddress)

		const Strategy = await getContractFactory('Strategy')
		const strategyImplementation = await Strategy.connect(owner).deploy()
		await strategyImplementation.deployed()

		const StrategyProxyFactoryAdmin = await getContractFactory('StrategyProxyFactoryAdmin')
		const factoryAdmin = await StrategyProxyFactoryAdmin.connect(owner).deploy(
			strategyImplementation.address,
			controllerAddress,
			oracle.address,
			whitelist.address
		)
		await factoryAdmin.deployed()

		const factoryAddress = await factoryAdmin.factory()
		const StrategyProxyFactory = await getContractFactory('StrategyProxyFactory')
		const strategyFactory = await StrategyProxyFactory.attach(factoryAddress)

		return [strategyFactory, controller, oracle, whitelist]
	},
	deployLoopRouter: async (owner, controller, adapter, weth) => {
		const LoopRouter = await getContractFactory('LoopRouter')
		const router = await LoopRouter.connect(owner).deploy(
			adapter.address,
			controller.address,
			weth.address
		)
		await router.deployed()

		return router
	},
	deployGenericRouter: async (owner, controller, weth) => {
		const GenericRouter = await ethers.getContractFactory('GenericRouter')
		const router = await GenericRouter.connect(owner).deploy(controller.address, weth.address)
		await router.deployed()
		return router
	}
}
