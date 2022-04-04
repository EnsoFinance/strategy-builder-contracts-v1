// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat')
const { ESTIMATOR_CATEGORY, ITEM_CATEGORY } = require('../lib/constants')
const deployments = require('../deployments.json')
const fs = require('fs')
const network = process.env.HARDHAT_NETWORK

const deployedContracts = {
	mainnet: {
		weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
		susd: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
		usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
		uniswapFactory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
		uniswapV3Factory: '0x1f98431c8ad98523631ae4a59f267346ea31f984',
		uniswapV3Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
		aaveAddressProvider: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
		curveAddressProvider: '0x0000000022D53366457F9d5E68Ec105046FC4383',
		synthetixAddressProvider: '0x823bE81bbF96BEc0e25CA13170F5AaCb5B79ba83',
		compoundComptroller: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
		ensoPool: '',
	},
	localhost: {
		weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
		susd: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
		usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
		uniswapFactory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
		uniswapV3Factory: '0x1f98431c8ad98523631ae4a59f267346ea31f984',
		uniswapV3Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
		aaveAddressProvider: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
		curveAddressProvider: '0x0000000022D53366457F9d5E68Ec105046FC4383',
		synthetixAddressProvider: '0x823bE81bbF96BEc0e25CA13170F5AaCb5B79ba83',
		compoundComptroller: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
		ensoPool: '0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b', // template address
	},
	kovan: {
		weth: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
		susd: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
		usdc: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
		uniswapFactory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
		uniswapV3Factory: '0x1f98431c8ad98523631ae4a59f267346ea31f984',
		uniswapV3Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
		aaveAddressProvider: '0x88757f2f99175387aB4C6a4b3067c77A695b0349',
		synthetixAddressProvider: '0x84f87E3636Aa9cC1080c07E6C61aDfDCc23c0db6',
		compoundComptroller: '',
		ensoPool: '0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b',
	},
}

async function main() {
	// Hardhat always runs the compile task when running scripts with its command
	// line interface.
	//
	// If this script is run directly using `node` you may want to call compile
	// manually to make sure everything is compiled
	// await hre.run('compile');
	const StrategyLibrary = await hre.ethers.getContractFactory('StrategyLibrary')
	const library = await StrategyLibrary.deploy()
	await library.deployed()

	const TokenRegistry = await hre.ethers.getContractFactory('TokenRegistry')
	const tokenRegistry = await TokenRegistry.deploy()
	await tokenRegistry.deployed()

	add2Deployments('TokenRegistry', tokenRegistry.address)

	const CurveDepositZapRegistry = await hre.ethers.getContractFactory('CurveDepositZapRegistry')
	const curveDepositZapRegistry = await CurveDepositZapRegistry.deploy()
	await curveDepositZapRegistry.deployed()

	add2Deployments('CurveDepositZapRegistry', curveDepositZapRegistry.address)

	const UniswapV3Registry = await hre.ethers.getContractFactory('UniswapV3Registry')
	const uniswapV3Registry = await UniswapV3Registry.deploy(
		1,
		deployedContracts[network].uniswapV3Factory,
		deployedContracts[network].weth
	)
	await uniswapV3Registry.deployed()

	add2Deployments('UniswapV3Registry', uniswapV3Registry.address)

	const ChainlinkRegistry = await hre.ethers.getContractFactory('ChainlinkRegistry')
	const chainlinkRegistry = await ChainlinkRegistry.deploy()
	await chainlinkRegistry.deployed()

	add2Deployments('ChainlinkRegistry', chainlinkRegistry.address)

	// Add oracles
	const UniswapOracle = await hre.ethers.getContractFactory('UniswapNaiveOracle')
	const uniswapOracle = await UniswapOracle.deploy(
		deployedContracts[network].uniswapFactory,
		deployedContracts[network].weth
	)
	await uniswapOracle.deployed()

	add2Deployments('UniswapOracle', uniswapOracle.address)

	const ChainlinkOracle = await hre.ethers.getContractFactory('ChainlinkOracle')
	const chainlinkOracle = await ChainlinkOracle.deploy(chainlinkRegistry.address, deployedContracts[network].weth)
	await chainlinkOracle.deployed()

	add2Deployments('ChainlinkOracle', chainlinkOracle.address)

	const EnsoOracle = await hre.ethers.getContractFactory('EnsoOracle')
	const ensoOracle = await EnsoOracle.deploy(
		tokenRegistry.address,
		deployedContracts[network].weth,
		deployedContracts[network].susd
	)
	await ensoOracle.deployed()

	add2Deployments('EnsoOracle', ensoOracle.address)

	// Add token estimators
	const BasicEstimator = await hre.ethers.getContractFactory('BasicEstimator')

	const defaultEstimator = await BasicEstimator.deploy(uniswapOracle.address)
	await defaultEstimator.deployed()
	let tx = await tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.DEFAULT_ORACLE, defaultEstimator.address)
	await tx.wait()

	add2Deployments('DefaultEstimator', defaultEstimator.address)

	const chainlinkEstimator = await BasicEstimator.deploy(chainlinkOracle.address)
	await chainlinkEstimator.deployed()
	tx = await tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, chainlinkEstimator.address)
	await tx.wait()

	add2Deployments('ChainlinkEstimator', chainlinkEstimator.address)

	const AaveEstimator = await hre.ethers.getContractFactory('AaveEstimator')
	const aaveEstimator = await AaveEstimator.deploy()
	await aaveEstimator.deployed()
	tx = await tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.AAVE_V2, aaveEstimator.address)
	await tx.wait()

	add2Deployments('AaveEstimator', aaveEstimator.address)

	const AaveDebtEstimator = await hre.ethers.getContractFactory('AaveDebtEstimator')
	const aaveDebtEstimator = await AaveDebtEstimator.deploy()
	await aaveDebtEstimator.deployed()
	tx = await tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.AAVE_DEBT, aaveDebtEstimator.address)
	await tx.wait()

	add2Deployments('AaveDebtEstimator', aaveDebtEstimator.address)

	const CompoundEstimator = await hre.ethers.getContractFactory('CompoundEstimator')
	const compoundEstimator = await CompoundEstimator.deploy()
	await compoundEstimator.deployed()
	tx = await tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.COMPOUND, compoundEstimator.address)
	await tx.wait()

	add2Deployments('CompoundEstimator', compoundEstimator.address)

	const CurveEstimator = await hre.ethers.getContractFactory('CurveEstimator')
	const curveEstimator = await CurveEstimator.deploy()
	await curveEstimator.deployed()
	tx = await tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.CURVE, curveEstimator.address)
	await tx.wait()

	add2Deployments('CurveEstimator', curveEstimator.address)

	const CurveGaugeEstimator = await hre.ethers.getContractFactory('CurveGaugeEstimator')
	const curveGaugeEstimator = await CurveGaugeEstimator.deploy()
	await curveGaugeEstimator.deployed()
	tx = await tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.CURVE_GAUGE, curveGaugeEstimator.address)
	await tx.wait()

	add2Deployments('CurveGaugeEstimator', curveGaugeEstimator.address)

	const EmergencyEstimator = await hre.ethers.getContractFactory('EmergencyEstimator')
	const emergencyEstimator = await EmergencyEstimator.deploy()
	await emergencyEstimator.deployed()
	tx = await tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.BLOCKED, emergencyEstimator.address)
	await tx.wait()

	add2Deployments('EmergencyEstimator', emergencyEstimator.address)

	const StrategyEstimator = await hre.ethers.getContractFactory('StrategyEstimator')
	const strategyEstimator = await StrategyEstimator.deploy()
	await strategyEstimator.deployed()
	tx = await tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.STRATEGY, strategyEstimator.address)
	await tx.wait()

	add2Deployments('StrategyEstimator', strategyEstimator.address)

	const UniswapV2Estimator = await hre.ethers.getContractFactory('UniswapV2Estimator')
	const uniswapV2Estimator = await UniswapV2Estimator.deploy()

	await uniswapV2Estimator.deployed()
	tx = await tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.UNISWAP_V2_LP, uniswapV2Estimator.address)
	await tx.wait()

	add2Deployments('UniswapV2Estimator', uniswapV2Estimator.address)

	const YEarnV2Estimator = await hre.ethers.getContractFactory('YEarnV2Estimator')
	const yearnV2Estimator = await YEarnV2Estimator.deploy()
	await yearnV2Estimator.deployed()
	tx = await tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.YEARN_V2, yearnV2Estimator.address)
	await tx.wait()

	add2Deployments('YEarnV2Estimator', yearnV2Estimator.address)

	tx = await tokenRegistry.addItem(
		ITEM_CATEGORY.RESERVE,
		ESTIMATOR_CATEGORY.DEFAULT_ORACLE,
		deployedContracts[network].weth
	)
	await tx.wait()
	tx = await tokenRegistry.addItem(
		ITEM_CATEGORY.RESERVE,
		ESTIMATOR_CATEGORY.CHAINLINK_ORACLE,
		deployedContracts[network].susd
	)
	await tx.wait()

	const Whitelist = await hre.ethers.getContractFactory('Whitelist')
	const whitelist = await Whitelist.deploy()
	await whitelist.deployed()

	add2Deployments('Whitelist', whitelist.address)

	const PlatformProxyAdmin = await hre.ethers.getContractFactory('PlatformProxyAdmin')
	const platformProxyAdmin = await PlatformProxyAdmin.deploy()
	await platformProxyAdmin.deployed()
	const controllerAddress = await platformProxyAdmin.controller()
	const factoryAddress = await platformProxyAdmin.factory()

	add2Deployments('PlatformProxyAdmin', platformProxyAdmin.address)

	// Controller implementation
	const StrategyController = await hre.ethers.getContractFactory('StrategyController', {
		libraries: {
			StrategyLibrary: library.address,
		},
	})
	const controllerImplementation = await StrategyController.deploy(factoryAddress)
	await controllerImplementation.deployed()

	// Factory implementation
	const StrategyProxyFactory = await hre.ethers.getContractFactory('StrategyProxyFactory')
	const factoryImplementation = await StrategyProxyFactory.deploy(controllerAddress)
	await factoryImplementation.deployed()

	// Strategy implementation
	const Strategy = await hre.ethers.getContractFactory('Strategy')
	const strategyImplementation = await Strategy.deploy(
		factoryAddress,
		controllerAddress,
		deployedContracts[network].synthetixAddressProvider,
		deployedContracts[network].aaveAddressProvider
	)
	await strategyImplementation.deployed()

	// Initialize platform
	await platformProxyAdmin.initialize(
		controllerImplementation.address,
		factoryImplementation.address,
		strategyImplementation.address,
		ensoOracle.address,
		tokenRegistry.address,
		whitelist.address,
		deployedContracts[network].ensoPool
	)
	add2Deployments('StrategyProxyFactory', factoryAddress)
	add2Deployments('StrategyController', controllerAddress)

	tx = await tokenRegistry.transferOwnership(factoryAddress)
	await tx.wait()

	const LoopRouter = await hre.ethers.getContractFactory('LoopRouter', {
		libraries: {
			StrategyLibrary: library.address,
		},
	})
	const loopRouter = await LoopRouter.deploy(controllerAddress)
	await loopRouter.deployed()

	add2Deployments('LoopRouter', loopRouter.address)

	tx = await whitelist.approve(loopRouter.address)
	await tx.wait()

	const FullRouter = await hre.ethers.getContractFactory('FullRouter', {
		libraries: {
			StrategyLibrary: library.address,
		},
	})
	const fullRouter = await FullRouter.deploy(deployedContracts[network].aaveAddressProvider, controllerAddress)
	await fullRouter.deployed()

	add2Deployments('FullRouter', fullRouter.address)

	tx = await whitelist.approve(fullRouter.address)
	await tx.wait()

	const GenericRouter = await hre.ethers.getContractFactory('GenericRouter')
	const genericRouter = await GenericRouter.deploy(controllerAddress)
	await genericRouter.deployed()

	add2Deployments('GenericRouter', genericRouter.address)

	tx = await whitelist.approve(genericRouter.address)
	await tx.wait()

	const BatchDepositRouter = await hre.ethers.getContractFactory('BatchDepositRouter', {
		libraries: {
			StrategyLibrary: library.address,
		},
	})
	const batchDepositRouter = await BatchDepositRouter.deploy(controllerAddress)
	await batchDepositRouter.deployed()

	add2Deployments('BatchDepositRouter', batchDepositRouter.address)

	tx = await whitelist.approve(batchDepositRouter.address)
	await tx.wait()

	const UniswapV2Adapter = await hre.ethers.getContractFactory('UniswapV2Adapter')
	const uniswapV2Adapter = await UniswapV2Adapter.deploy(
		deployedContracts[network].uniswapFactory,
		deployedContracts[network].weth
	)
	await uniswapV2Adapter.deployed()

	add2Deployments('UniswapV2Adapter', uniswapV2Adapter.address)

	tx = await whitelist.approve(uniswapV2Adapter.address)
	await tx.wait()

	const UniswapV3Adapter = await hre.ethers.getContractFactory('UniswapV3Adapter')
	const uniswapV3Adapter = await UniswapV3Adapter.deploy(
		uniswapV3Registry.address,
		deployedContracts[network].uniswapV3Router,
		deployedContracts[network].weth
	)
	await uniswapV3Adapter.deployed()

	add2Deployments('UniswapV3Adapter', uniswapV3Adapter.address)

	tx = await whitelist.approve(uniswapV3Adapter.address)
	await tx.wait()

	const MetaStrategyAdapter = await hre.ethers.getContractFactory('MetaStrategyAdapter')
	const metaStrategyAdapter = await MetaStrategyAdapter.deploy(
		controllerAddress,
		fullRouter.address,
		deployedContracts[network].weth
	)
	await metaStrategyAdapter.deployed()

	add2Deployments('MetaStrategyAdapter', metaStrategyAdapter.address)

	tx = await whitelist.approve(metaStrategyAdapter.address)
	await tx.wait()

	const SynthetixAdapter = await hre.ethers.getContractFactory('SynthetixAdapter')
	const synthetixAdapter = await SynthetixAdapter.deploy(
		deployedContracts[network].synthetixAddressProvider,
		deployedContracts[network].weth
	)
	await synthetixAdapter.deployed()

	add2Deployments('SynthetixAdapter', synthetixAdapter.address)

	tx = await whitelist.approve(synthetixAdapter.address)
	await tx.wait()

	const CurveAdapter = await hre.ethers.getContractFactory('CurveAdapter')
	const curveAdapter = await CurveAdapter.deploy(
		deployedContracts[network].curveAddressProvider,
		deployedContracts[network].weth
	)
	await curveAdapter.deployed()

	add2Deployments('CurveAdapter', curveAdapter.address)

	tx = await whitelist.approve(curveAdapter.address)
	await tx.wait()

	const CurveLPAdapter = await hre.ethers.getContractFactory('CurveLPAdapter')
	const curveLPAdapter = await CurveLPAdapter.deploy(
		deployedContracts[network].curveAddressProvider,
		curveDepositZapRegistry.address,
		deployedContracts[network].weth
	)
	await curveLPAdapter.deployed()

	add2Deployments('CurveLPAdapter', curveLPAdapter.address)

	tx = await whitelist.approve(curveLPAdapter.address)
	await tx.wait()

	const CurveRewardsAdapter = await hre.ethers.getContractFactory('CurveRewardsAdapter')
	const curveRewardsAdapter = await CurveRewardsAdapter.deploy(
		deployedContracts[network].curveAddressProvider,
		deployedContracts[network].weth
	)
	await curveRewardsAdapter.deployed()

	add2Deployments('CurveRewardsAdapter', curveRewardsAdapter.address)

	tx = await whitelist.approve(curveRewardsAdapter.address)
	await tx.wait()

	const AaveLendAdapter = await hre.ethers.getContractFactory('AaveLendAdapter')
	const aaveLendAdapter = await AaveLendAdapter.deploy(
		deployedContracts[network].aaveAddressProvider,
		controllerAddress,
		deployedContracts[network].weth
	)
	await aaveLendAdapter.deployed()

	add2Deployments('AaveLendAdapter', aaveLendAdapter.address)

	tx = await whitelist.approve(aaveLendAdapter.address)
	await tx.wait()

	const AaveBorrowAdapter = await hre.ethers.getContractFactory('AaveBorrowAdapter')
	const aaveBorrowAdapter = await AaveBorrowAdapter.deploy(
		deployedContracts[network].aaveAddressProvider,
		deployedContracts[network].weth
	)
	await aaveBorrowAdapter.deployed()

	add2Deployments('AaveBorrowAdapter', aaveBorrowAdapter.address)

	tx = await whitelist.approve(aaveBorrowAdapter.address)
	await tx.wait()

	const CompoundAdapter = await hre.ethers.getContractFactory('CompoundAdapter')
	const compoundAdapter = await CompoundAdapter.deploy(
		deployedContracts[network].compoundComptroller,
		deployedContracts[network].weth
	)
	await compoundAdapter.deployed()

	add2Deployments('CompoundAdapter', compoundAdapter.address)

	tx = await whitelist.approve(compoundAdapter.address)
	await tx.wait()

	const YEarnV2Adapter = await hre.ethers.getContractFactory('YEarnV2Adapter')
	const yearnAdapter = await YEarnV2Adapter.deploy(deployedContracts[network].weth)
	await yearnAdapter.deployed()

	add2Deployments('YEarnV2Adapter', yearnAdapter.address)

	tx = await whitelist.approve(yearnAdapter.address)
	await tx.wait()

	const Leverage2XAdapter = await hre.ethers.getContractFactory('Leverage2XAdapter')
	const leverageAdapter = await Leverage2XAdapter.deploy(
		uniswapV2Adapter.address,
		aaveLendAdapter.address,
		aaveBorrowAdapter.address,
		deployedContracts[process.env.HARDHAT_NETWORK].usdc,
		deployedContracts[process.env.HARDHAT_NETWORK].weth
	)
	await leverageAdapter.deployed()

	add2Deployments('Leverage2XAdapter', leverageAdapter.address)

	tx = await whitelist.approve(leverageAdapter.address)
	await tx.wait()

	write2File()
}

const contracts = {}
const add2Deployments = (contractTitle, address) => {
	contracts[contractTitle] = address
	console.log(contractTitle + ': ' + address)
}
const write2File = () => {
	const data = JSON.stringify({ ...deployments, [network]: contracts }, null, 2)
	fs.writeFileSync('./deployments.json', data)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
