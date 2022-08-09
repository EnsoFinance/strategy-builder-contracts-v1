// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat'
import fs from 'fs'
import { Contract } from 'ethers'
import { waitForDeployment, waitForTransaction, TransactionArgs } from './common'
import { ESTIMATOR_CATEGORY, ITEM_CATEGORY } from '../lib/constants'
import deploymentsJSON from '../deployments.json'

const deployments: {[key: string]: {[key: string]: string}} = deploymentsJSON
// If true it will deploy contract regardless of whether there is an address currently on the network
let overwrite = false

let contracts: {[key: string]: string} = {}
let network: string
if (process.env.HARDHAT_NETWORK) {
	network = process.env.HARDHAT_NETWORK
	//ts-ignore
	if (deployments[network]) contracts = deployments[network]
	if (network === 'mainnet') overwrite = false // Don't overwrite on mainnet
}

type Addresses = {
	weth: string;
	susd: string;
	usdc: string;
	uniswapV2Factory: string;
	uniswapV3Factory: string;
	uniswapV3Router: string;
	kyberFactory: string;
	kyberRouter: string;
	sushiFactory: string;
	aaveIncentivesController: string;
	aaveAddressProvider: string;
	curveAddressProvider: string;
	synthetixAddressProvider: string;
	synthRedeemer: string;
	balancerRegistry: string;
	compoundComptroller: string;
	ensoPool: string;
}

const deployedContracts: {[key: string]: Addresses} = {
	mainnet: {
		weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
		susd: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
		usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
		uniswapV2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
		uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
		uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
		kyberFactory: '0x833e4083B7ae46CeA85695c4f7ed25CDAd8886dE',
		kyberRouter: '0x1c87257f5e8609940bc751a07bb085bb7f8cdbe6',
		sushiFactory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
		aaveIncentivesController: '0xd784927ff2f95ba542bfc824c8a8a98f3495f6b5',
		aaveAddressProvider: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
		curveAddressProvider: '0x0000000022D53366457F9d5E68Ec105046FC4383',
		synthetixAddressProvider: '0x823bE81bbF96BEc0e25CA13170F5AaCb5B79ba83',
		synthRedeemer: '0xe533139Af961c9747356D947838c98451015e234',
		balancerRegistry: '0x65e67cbc342712DF67494ACEfc06fe951EE93982',
		compoundComptroller: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
		ensoPool: '0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F', // treasury multisig
	},
	localhost: {
		weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
		susd: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
		usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
		uniswapV2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
		uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
		uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
		kyberFactory: '0x833e4083B7ae46CeA85695c4f7ed25CDAd8886dE',
		kyberRouter: '0x1c87257f5e8609940bc751a07bb085bb7f8cdbe6',
		sushiFactory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
		aaveIncentivesController: '0xd784927ff2f95ba542bfc824c8a8a98f3495f6b5',
		aaveAddressProvider: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
		curveAddressProvider: '0x0000000022D53366457F9d5E68Ec105046FC4383',
		synthetixAddressProvider: '0x823bE81bbF96BEc0e25CA13170F5AaCb5B79ba83',
		synthRedeemer: '0xe533139Af961c9747356D947838c98451015e234',
		balancerRegistry: '0x65e67cbc342712DF67494ACEfc06fe951EE93982',
		compoundComptroller: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
		ensoPool: '0x0c58B57E2e0675eDcb2c7c0f713320763Fc9A77b', // template address
	},
	kovan: {
		weth: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
		susd: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
		usdc: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
		uniswapV2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
		uniswapV3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
		uniswapV3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
		kyberFactory: '',
		kyberRouter: '',
		sushiFactory: '',
		aaveIncentivesController: '0xd784927ff2f95ba542bfc824c8a8a98f3495f6b5',
		aaveAddressProvider: '0x88757f2f99175387aB4C6a4b3067c77A695b0349',
		curveAddressProvider: '',
		synthetixAddressProvider: '0x84f87E3636Aa9cC1080c07E6C61aDfDCc23c0db6',
		synthRedeemer: '0xe533139Af961c9747356D947838c98451015e234',
		balancerRegistry: '',
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
	const [ signer ] = await hre.ethers.getSigners()
	const owner = network == 'mainnet' ? '0xca702d224D61ae6980c8c7d4D98042E22b40FFdB' : signer.address //smart contract upgrades multisig
	console.log("Owner: ", owner)

	// Setup libraries
	let strategyLibraryAddress: string
	if (overwrite || !contracts['StrategyLibrary'] ) {
		const StrategyLibrary = await hre.ethers.getContractFactory('StrategyLibrary')
		const library = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return StrategyLibrary.deploy(txArgs)
		}, signer)
		strategyLibraryAddress = library.address
		add2Deployments('StrategyLibrary', strategyLibraryAddress)
	} else {
		strategyLibraryAddress = contracts['StrategyLibrary']
	}

	let controllerLibraryAddress: string
	if (overwrite || !contracts['ControllerLibrary'] ) {
		const ControllerLibrary = await hre.ethers.getContractFactory('ControllerLibrary', {
			libraries: {
				StrategyLibrary: strategyLibraryAddress,
			}
		})
		const library = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return ControllerLibrary.deploy(txArgs)
		}, signer)
		controllerLibraryAddress = library.address
		add2Deployments('ControllerLibrary', controllerLibraryAddress)
	} else {
		controllerLibraryAddress = contracts['ControllerLibrary']
	}

	let strategyClaimAddress: string
	if (overwrite || !contracts['StrategyClaim'] ) {
		const StrategyClaim = await hre.ethers.getContractFactory('StrategyClaim')
		const library = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return StrategyClaim.deploy(txArgs)
		}, signer)
		strategyClaimAddress = library.address
		add2Deployments('StrategyClaim', controllerLibraryAddress)
	} else {
		strategyClaimAddress = contracts['StrategyClaim']
	}

	//Setup library-dependent contract factories
	const Strategy = await hre.ethers.getContractFactory('Strategy', {
		libraries: {
			StrategyClaim: strategyClaimAddress,
		}
	})
	const StrategyController = await hre.ethers.getContractFactory('StrategyController', {
		libraries: {
			ControllerLibrary: controllerLibraryAddress,
		}
	})
	const LoopRouter = await hre.ethers.getContractFactory('LoopRouter', {
		libraries: {
			StrategyLibrary: strategyLibraryAddress,
		}
	})
	const FullRouter = await hre.ethers.getContractFactory('FullRouter', {
		libraries: {
			StrategyLibrary: strategyLibraryAddress,
		}
	})
	const BatchDepositRouter = await hre.ethers.getContractFactory('BatchDepositRouter', {
		libraries: {
			StrategyLibrary: strategyLibraryAddress,
		}
	})

	// Setup other contract factories
	const TokenRegistry = await hre.ethers.getContractFactory('TokenRegistry')
	const CurveDepositZapRegistry = await hre.ethers.getContractFactory('CurveDepositZapRegistry')
	const UniswapV3Registry = await hre.ethers.getContractFactory('UniswapV3Registry')
	const ChainlinkRegistry = await hre.ethers.getContractFactory('ChainlinkRegistry')
	const UniswapOracle = await hre.ethers.getContractFactory('UniswapV3Oracle')
	const ChainlinkOracle = await hre.ethers.getContractFactory('ChainlinkOracle')
	const EnsoOracle = await hre.ethers.getContractFactory('EnsoOracle')
	const BasicEstimator = await hre.ethers.getContractFactory('BasicEstimator')
	const AaveV2Estimator = await hre.ethers.getContractFactory('AaveV2Estimator')
	const AaveV2DebtEstimator = await hre.ethers.getContractFactory('AaveV2DebtEstimator')
	const CompoundEstimator = await hre.ethers.getContractFactory('CompoundEstimator')
	const CurveLPEstimator = await hre.ethers.getContractFactory('CurveLPEstimator')
	const CurveGaugeEstimator = await hre.ethers.getContractFactory('CurveGaugeEstimator')
	const EmergencyEstimator = await hre.ethers.getContractFactory('EmergencyEstimator')
	const StrategyEstimator = await hre.ethers.getContractFactory('StrategyEstimator')
	//const UniswapV2LPEstimator = await hre.ethers.getContractFactory('UniswapV2LPEstimator')
	const YEarnV2Estimator = await hre.ethers.getContractFactory('YEarnV2Estimator')
	const Whitelist = await hre.ethers.getContractFactory('Whitelist')
	const PlatformProxyAdmin = await hre.ethers.getContractFactory('PlatformProxyAdmin')
	const StrategyProxyFactory = await hre.ethers.getContractFactory('StrategyProxyFactory')
	const StrategyControllerPaused = await hre.ethers.getContractFactory('StrategyControllerPaused')
	const MulticallRouter = await hre.ethers.getContractFactory('MulticallRouter')
	const BalancerAdapter = await hre.ethers.getContractFactory('BalancerAdapter')
	const UniswapV2Adapter = await hre.ethers.getContractFactory('UniswapV2Adapter')
	//const UniswapV2LPAdapter = await hre.ethers.getContractFactory('UniswapV2LPAdapter')
	const UniswapV3Adapter = await hre.ethers.getContractFactory('UniswapV3Adapter')
	const MetaStrategyAdapter = await hre.ethers.getContractFactory('MetaStrategyAdapter')
	const SynthetixAdapter = await hre.ethers.getContractFactory('SynthetixAdapter')
	const SynthRedeemerAdapter = await hre.ethers.getContractFactory('SynthRedeemerAdapter')
	const CurveAdapter = await hre.ethers.getContractFactory('CurveAdapter')
	const CurveLPAdapter = await hre.ethers.getContractFactory('CurveLPAdapter')
	const CurveGaugeAdapter = await hre.ethers.getContractFactory('CurveGaugeAdapter')
	const AaveV2Adapter = await hre.ethers.getContractFactory('AaveV2Adapter')
	const AaveV2DebtAdapter = await hre.ethers.getContractFactory('AaveV2DebtAdapter')
	const CompoundAdapter = await hre.ethers.getContractFactory('CompoundAdapter')
	const YEarnV2Adapter = await hre.ethers.getContractFactory('YEarnV2Adapter')
	const KyberSwapAdapter = await hre.ethers.getContractFactory('KyberSwapAdapter')

	let platformProxyAdmin: Contract
	if (overwrite || !contracts['PlatformProxyAdmin'] ) {
		platformProxyAdmin = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return PlatformProxyAdmin.deploy(txArgs)
		}, signer)

		add2Deployments('PlatformProxyAdmin', platformProxyAdmin.address)
	} else {
		platformProxyAdmin = PlatformProxyAdmin.attach(contracts['PlatformProxyAdmin'])
	}

	const [controllerAddress, factoryAddress] = await Promise.all([
		platformProxyAdmin.controller(),
		platformProxyAdmin.factory()
	])

	let tokenRegistry: Contract
	if (overwrite || !contracts['TokenRegistry'] ) {
		tokenRegistry = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return TokenRegistry.deploy(txArgs)
		}, signer)

		add2Deployments('TokenRegistry', tokenRegistry.address)
	} else {
		tokenRegistry = TokenRegistry.attach(contracts['TokenRegistry'])
	}
	const tokenRegistryOwner = await tokenRegistry.owner()

	let curveDepositZapRegistryAddress: string
	if (overwrite || !contracts['CurveDepositZapRegistry'] ) {
		const curveDepositZapRegistry = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return CurveDepositZapRegistry.deploy(txArgs)
		}, signer)
		curveDepositZapRegistryAddress = curveDepositZapRegistry.address

		add2Deployments('CurveDepositZapRegistry', curveDepositZapRegistryAddress)
	} else {
		curveDepositZapRegistryAddress = contracts['CurveDepositZapRegistry']
	}

	let uniswapV3RegistryAddress: string
	if (overwrite || !contracts['UniswapV3Registry'] ) {
		const uniswapV3Registry = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return UniswapV3Registry.deploy(
				deployedContracts[network].uniswapV3Factory,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)
		uniswapV3RegistryAddress = uniswapV3Registry.address

		add2Deployments('UniswapV3Registry', uniswapV3RegistryAddress)
	} else {
		uniswapV3RegistryAddress = contracts['UniswapV3Registry']
	}

	let chainlinkRegistryAddress: string
	if (overwrite || !contracts['ChainlinkRegistry'] ) {
		const chainlinkRegistry = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return ChainlinkRegistry.deploy(txArgs)
		}, signer)
		chainlinkRegistryAddress = chainlinkRegistry.address

		add2Deployments('ChainlinkRegistry', chainlinkRegistryAddress)
	} else {
		chainlinkRegistryAddress = contracts['ChainlinkRegistry']
	}

	// Add oracles
	let uniswapOracleAddress: string
	if (overwrite || !contracts['UniswapOracle'] ) {
		const uniswapOracle = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return UniswapOracle.deploy(
		 		uniswapV3RegistryAddress,
		 		deployedContracts[network].weth,
				txArgs
			)
		}, signer)
		uniswapOracleAddress = uniswapOracle.address

		add2Deployments('UniswapOracle', uniswapOracleAddress)
	} else {
		uniswapOracleAddress = contracts['UniswapOracle']
	}

	let chainlinkOracleAddress: string
	if (overwrite || !contracts['ChainlinkOracle'] ) {
		const chainlinkOracle = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return ChainlinkOracle.deploy(
				chainlinkRegistryAddress,
				deployedContracts[network].weth,
				txArgs)
		}, signer)
		chainlinkOracleAddress = chainlinkOracle.address

		add2Deployments('ChainlinkOracle', chainlinkOracleAddress)
	} else {
		chainlinkOracleAddress = contracts['ChainlinkOracle']
	}

	let ensoOracleAddress: string
	if (overwrite || !contracts['EnsoOracle'] ) {
		const ensoOracle = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return EnsoOracle.deploy(
				factoryAddress,
				deployedContracts[network].weth,
				deployedContracts[network].susd,
				txArgs
			)
		}, signer)
		ensoOracleAddress = ensoOracle.address

		add2Deployments('EnsoOracle', ensoOracleAddress)
	} else {
		ensoOracleAddress = contracts['EnsoOracle']
	}

	// For registering estimators
	let strategyProxyFactory: Contract
	let factoryOwner: string = ''
	if (contracts['StrategyProxyFactory']) {
		strategyProxyFactory = StrategyProxyFactory.attach(contracts['StrategyProxyFactory'])
		factoryOwner = await strategyProxyFactory.owner()
	}

	// Add token estimators
	if (overwrite || !contracts['DefaultEstimator'] ) {
		const defaultEstimator = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return BasicEstimator.deploy(uniswapOracleAddress, txArgs)
		}, signer)

		add2Deployments('DefaultEstimator', defaultEstimator.address)

		if (tokenRegistryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.DEFAULT_ORACLE, defaultEstimator.address, txArgs)
			}, signer)
		} else if (factoryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return strategyProxyFactory.addEstimatorToRegistry(ESTIMATOR_CATEGORY.DEFAULT_ORACLE, defaultEstimator.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['ChainlinkEstimator'] ) {
		const chainlinkEstimator = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return BasicEstimator.deploy(chainlinkOracleAddress, txArgs)
		}, signer)

		add2Deployments('ChainlinkEstimator', chainlinkEstimator.address)

		if (tokenRegistryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, chainlinkEstimator.address, txArgs)
			}, signer)
		} else if (factoryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return strategyProxyFactory.addEstimatorToRegistry(ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, chainlinkEstimator.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['AaveV2Estimator'] ) {
		const aaveV2Estimator = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return AaveV2Estimator.deploy(txArgs)
		}, signer)

		add2Deployments('AaveV2Estimator', aaveV2Estimator.address)
		add2Deployments('AaveEstimator', aaveV2Estimator.address) //Alias

		if (tokenRegistryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.AAVE_V2, aaveV2Estimator.address, txArgs)
			}, signer)
		} else if (factoryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return strategyProxyFactory.addEstimatorToRegistry(ESTIMATOR_CATEGORY.AAVE_V2, aaveV2Estimator.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['AaveV2DebtEstimator'] ) {
		const aaveV2DebtEstimator = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return AaveV2DebtEstimator.deploy(txArgs)
		}, signer)

		add2Deployments('AaveV2DebtEstimator', aaveV2DebtEstimator.address)
		add2Deployments('AaveDebtEstimator', aaveV2DebtEstimator.address) //Alias

		if (tokenRegistryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.AAVE_V2_DEBT, aaveV2DebtEstimator.address, txArgs)
			}, signer)
		} else if (factoryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return strategyProxyFactory.addEstimatorToRegistry(ESTIMATOR_CATEGORY.AAVE_V2_DEBT, aaveV2DebtEstimator.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['CompoundEstimator'] ) {
		const compoundEstimator = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return CompoundEstimator.deploy(txArgs)
		}, signer)

		add2Deployments('CompoundEstimator', compoundEstimator.address)

		if (tokenRegistryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.COMPOUND, compoundEstimator.address, txArgs)
			}, signer)
		} else if (factoryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return strategyProxyFactory.addEstimatorToRegistry(ESTIMATOR_CATEGORY.COMPOUND, compoundEstimator.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['CurveLPEstimator'] ) {
		const curveLPEstimator = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return CurveLPEstimator.deploy(txArgs)
		}, signer)

		add2Deployments('CurveLPEstimator', curveLPEstimator.address)
		add2Deployments('CurveEstimator', curveLPEstimator.address) //Alias

		if (tokenRegistryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.CURVE_LP, curveLPEstimator.address, txArgs)
			}, signer)
		} else if (factoryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return strategyProxyFactory.addEstimatorToRegistry(ESTIMATOR_CATEGORY.CURVE_LP, curveLPEstimator.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['CurveGaugeEstimator'] ) {
		const curveGaugeEstimator = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return CurveGaugeEstimator.deploy(txArgs)
		}, signer)

		add2Deployments('CurveGaugeEstimator', curveGaugeEstimator.address)

		if (tokenRegistryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.CURVE_GAUGE, curveGaugeEstimator.address, txArgs)
			}, signer)
		} else if (factoryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return strategyProxyFactory.addEstimatorToRegistry(ESTIMATOR_CATEGORY.CURVE_GAUGE, curveGaugeEstimator.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['EmergencyEstimator'] ) {
		const emergencyEstimator = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return EmergencyEstimator.deploy(txArgs)
		}, signer)

		add2Deployments('EmergencyEstimator', emergencyEstimator.address)

		if (tokenRegistryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.BLOCKED, emergencyEstimator.address, txArgs)
			}, signer)
		} else if (factoryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return strategyProxyFactory.addEstimatorToRegistry(ESTIMATOR_CATEGORY.BLOCKED, emergencyEstimator.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['StrategyEstimator'] ) {
		const strategyEstimator = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return StrategyEstimator.deploy(txArgs)
		}, signer)

		add2Deployments('StrategyEstimator', strategyEstimator.address)

		if (tokenRegistryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.STRATEGY, strategyEstimator.address, txArgs)
			}, signer)
		} else if (factoryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return strategyProxyFactory.addEstimatorToRegistry(ESTIMATOR_CATEGORY.STRATEGY, strategyEstimator.address, txArgs)
			}, signer)
		}
	}

	/*
	if (overwrite || !contracts['UniswapV2LPEstimator'] ) {
		const uniswapV2LPEstimator = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return UniswapV2LPEstimator.deploy(txArgs)
		}, signer)

		add2Deployments('UniswapV2LPEstimator', uniswapV2LPEstimator.address)
		add2Deployments('UniswapV2Estimator', uniswapV2LPEstimator.address) //Alias

		if (tokenRegistryOwner == signer.address) {
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				console.log("Adding estimator...")
				return tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.UNISWAP_V2_LP, uniswapV2LPEstimator.address, txArgs)
			}, signer)
		} else if (factoryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return strategyProxyFactory.addEstimatorToRegistry(ESTIMATOR_CATEGORY.UNISWAP_V2_LP, uniswapV2LPEstimator.address, txArgs)
			}, signer)
		}
	}
	*/

	if (overwrite || !contracts['YEarnV2Estimator'] ) {
		const yearnV2Estimator = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return YEarnV2Estimator.deploy(txArgs)
		}, signer)

		add2Deployments('YEarnV2Estimator', yearnV2Estimator.address)

		if (tokenRegistryOwner == signer.address) {
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				console.log("Adding estimator...")
				return tokenRegistry.addEstimator(ESTIMATOR_CATEGORY.YEARN_V2, yearnV2Estimator.address, txArgs)
			}, signer)
		} else if (factoryOwner == signer.address) {
			console.log("Adding estimator...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return strategyProxyFactory.addEstimatorToRegistry(ESTIMATOR_CATEGORY.YEARN_V2, yearnV2Estimator.address, txArgs)
			}, signer)
		}
	}

	let whitelist: Contract
	let whitelistOwner: string
	if (overwrite || !contracts['Whitelist'] ) {
		whitelist = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return Whitelist.deploy(txArgs)
		}, signer)
		whitelistOwner = signer.address

		add2Deployments('Whitelist', whitelist.address)
	} else {
		whitelist = Whitelist.attach(contracts['Whitelist'])
		whitelistOwner = await whitelist.owner()
	}

	if (overwrite || !contracts['StrategyController'] || !contracts['StrategyProxyFactory']) {
		// Controller implementation
		const controllerImplementation = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return StrategyController.deploy(factoryAddress, txArgs)
		}, signer)

		// Factory implementation
		const factoryImplementation = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return StrategyProxyFactory.deploy(controllerAddress, txArgs)
		}, signer)


		// Strategy implementation
		const strategyImplementation = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return Strategy.deploy(
				factoryAddress,
				controllerAddress,
				deployedContracts[network].synthetixAddressProvider,
				deployedContracts[network].aaveAddressProvider,
				txArgs
			)
		}, signer)

		// Initialize platform
		console.log("Initializing platform...")
		await waitForTransaction(async (txArgs: TransactionArgs) => {
			return platformProxyAdmin.initialize(
				controllerImplementation.address,
				factoryImplementation.address,
				strategyImplementation.address,
				ensoOracleAddress,
				tokenRegistry.address,
				whitelist.address,
				deployedContracts[network].ensoPool,
				txArgs
			)
		}, signer)
		add2Deployments('StrategyProxyFactory', factoryAddress)
		add2Deployments('StrategyProxyFactoryImplementation', factoryImplementation.address)
		add2Deployments('StrategyController', controllerAddress)
		add2Deployments('StrategyControllerImplementation', controllerImplementation.address)
		/*
			NOTE: We don't want to transfer ownership of factory immediately.
			We still need to register tokens
		*/
	}

	if (owner != signer.address && signer.address == await platformProxyAdmin.owner()) {
		console.log("Transfering PlatformProxyAdmin...")
		await waitForTransaction(async (txArgs: TransactionArgs) => {
			return platformProxyAdmin.transferOwnership(owner, txArgs)
		}, signer)
	}

	if (overwrite || !contracts['StrategyControllerPausedImplementation'] ) {
		const strategyControllerPaused = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return StrategyControllerPaused.deploy(factoryAddress, txArgs)
		}, signer)

		add2Deployments('StrategyControllerPausedImplementation', strategyControllerPaused.address)
	}

	if (overwrite || !contracts['LoopRouter'] ) {
		const loopRouter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return LoopRouter.deploy(controllerAddress, txArgs)
		}, signer)

		add2Deployments('LoopRouter', loopRouter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(loopRouter.address, txArgs)
			}, signer)
		}
	}

	let fullRouterAddress: string
	if (overwrite || !contracts['FullRouter'] ) {
		const fullRouter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return FullRouter.deploy(deployedContracts[network].aaveAddressProvider, controllerAddress, txArgs)
		}, signer)
		fullRouterAddress = fullRouter.address

		add2Deployments('FullRouter', fullRouter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(fullRouter.address, txArgs)
			}, signer)
		}
	} else {
		fullRouterAddress = contracts['FullRouter']
	}

	if (overwrite || !contracts['MulticallRouter'] ) {
		const multicallRouter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return MulticallRouter.deploy(controllerAddress, txArgs)
		}, signer)

		add2Deployments('MulticallRouter', multicallRouter.address)
		add2Deployments('GenericRouter', multicallRouter.address) //Alias

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(multicallRouter.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['BatchDepositRouter'] ) {
		const batchDepositRouter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return BatchDepositRouter.deploy(controllerAddress, txArgs)
		}, signer)

		add2Deployments('BatchDepositRouter', batchDepositRouter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(batchDepositRouter.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['UniswapV2Adapter'] ) {
		const uniswapV2Adapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return UniswapV2Adapter.deploy(
				deployedContracts[network].uniswapV2Factory,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)

		add2Deployments('UniswapV2Adapter', uniswapV2Adapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(uniswapV2Adapter.address, txArgs)
			}, signer)
		}
	}

	/*
	if (overwrite || !contracts['UniswapV2LPAdapter'] ) {
		const uniswapV2LPAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return UniswapV2LPAdapter.deploy(
				deployedContracts[network].uniswapV2Factory,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)

		add2Deployments('UniswapV2LPAdapter', uniswapV2LPAdapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(uniswapV2LPAdapter.address, txArgs)
			}, signer)
		}
	}
	*/

	if (overwrite || !contracts['UniswapV3Adapter'] ) {
		const uniswapV3Adapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return UniswapV3Adapter.deploy(
				uniswapV3RegistryAddress,
				deployedContracts[network].uniswapV3Router,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)

		add2Deployments('UniswapV3Adapter', uniswapV3Adapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(uniswapV3Adapter.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['MetaStrategyAdapter'] ) {
		const metaStrategyAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return MetaStrategyAdapter.deploy(
				controllerAddress,
				fullRouterAddress,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)

		add2Deployments('MetaStrategyAdapter', metaStrategyAdapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(metaStrategyAdapter.address, txArgs)
			}, signer)
		}
	}

	let synthetixAdapterAddress: string
	if (overwrite || !contracts['SynthetixAdapter'] ) {
		const synthetixAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return SynthetixAdapter.deploy(
				deployedContracts[network].synthetixAddressProvider,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)
		synthetixAdapterAddress = synthetixAdapter.address

		add2Deployments('SynthetixAdapter', synthetixAdapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(synthetixAdapter.address, txArgs)
			}, signer)
		}
	} else {
		synthetixAdapterAddress = contracts['SynthetixAdapter']
	}

	let synthRedeemerAdapterAddress: string
	if (overwrite || !contracts['SynthRedeemerAdapter'] ) {
		const synthRedeemerAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return SynthRedeemerAdapter.deploy(
				deployedContracts[network].synthRedeemer,
				deployedContracts[network].susd,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)
		synthRedeemerAdapterAddress = synthRedeemerAdapter.address

		add2Deployments('SynthRedeemerAdapter', synthRedeemerAdapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(synthRedeemerAdapter.address, txArgs)
			}, signer)
		}
	} else {
		synthRedeemerAdapterAddress = contracts['SynthRedeemerAdapter']
	}

	if (overwrite || !contracts['BalancerAdapter'] ) {
		const balancerAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return BalancerAdapter.deploy(
				deployedContracts[network].balancerRegistry,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)

		add2Deployments('BalancerAdapter', balancerAdapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(balancerAdapter.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['CurveAdapter'] ) {
		const curveAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return CurveAdapter.deploy(
				deployedContracts[network].curveAddressProvider,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)

		add2Deployments('CurveAdapter', curveAdapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(curveAdapter.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['CurveLPAdapter'] ) {
		const curveLPAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return CurveLPAdapter.deploy(
				deployedContracts[network].curveAddressProvider,
				curveDepositZapRegistryAddress,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)

		add2Deployments('CurveLPAdapter', curveLPAdapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(curveLPAdapter.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['CurveGaugeAdapter'] ) {
		const curveGaugeAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return CurveGaugeAdapter.deploy(
				deployedContracts[network].weth,
				tokenRegistry.address,
				ESTIMATOR_CATEGORY.CURVE_GAUGE,
				txArgs
			)
		}, signer)

		add2Deployments('CurveGaugeAdapter', curveGaugeAdapter.address)
		add2Deployments('CurveRewardsAdapter', curveGaugeAdapter.address) //Alias

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(curveGaugeAdapter.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['AaveV2Adapter'] ) {
		const aaveV2Adapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return AaveV2Adapter.deploy(
				deployedContracts[network].aaveAddressProvider,
				controllerAddress,
				deployedContracts[network].aaveIncentivesController,
				deployedContracts[network].weth,
				tokenRegistry.address,
				ESTIMATOR_CATEGORY.AAVE_V2,
				txArgs
			)
		}, signer)

		add2Deployments('AaveV2Adapter', aaveV2Adapter.address)
		add2Deployments('AaveLendAdapter', aaveV2Adapter.address) //Alias

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(aaveV2Adapter.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['AaveV2DebtAdapter']) {
		const aaveV2DebtAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return AaveV2DebtAdapter.deploy(
				deployedContracts[network].aaveAddressProvider,
				deployedContracts[network].aaveIncentivesController,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)

		add2Deployments('AaveV2DebtAdapter', aaveV2DebtAdapter.address)
		add2Deployments('AaveBorrowAdapter', aaveV2DebtAdapter.address) //Alias

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(aaveV2DebtAdapter.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['CompoundAdapter'] ) {
		const compoundAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return CompoundAdapter.deploy(
				deployedContracts[network].compoundComptroller,
				deployedContracts[network].weth,
				tokenRegistry.address,
				ESTIMATOR_CATEGORY.COMPOUND,
				txArgs
			)
		}, signer)

		add2Deployments('CompoundAdapter', compoundAdapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(compoundAdapter.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['YEarnV2Adapter'] ) {
		const yearnAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return YEarnV2Adapter.deploy(
				deployedContracts[network].weth,
				tokenRegistry.address,
				ESTIMATOR_CATEGORY.YEARN_V2,
				txArgs
			)
		}, signer)

		add2Deployments('YEarnV2Adapter', yearnAdapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(yearnAdapter.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['SushiSwapAdapter'] ) {
		const sushiSwapAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return UniswapV2Adapter.deploy(
				deployedContracts[network].sushiFactory,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)

		add2Deployments('SushiSwapAdapter', sushiSwapAdapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(sushiSwapAdapter.address, txArgs)
			}, signer)
		}
	}

	if (overwrite || !contracts['KyberSwapAdapter'] ) {
		const kyberSwapAdapter = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return KyberSwapAdapter.deploy(
				deployedContracts[network].kyberFactory,
				deployedContracts[network].kyberRouter,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)

		add2Deployments('KyberSwapAdapter', kyberSwapAdapter.address)

		if (signer.address === whitelistOwner) {
			console.log("Whitelisting...")
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(kyberSwapAdapter.address, txArgs)
			}, signer)
		}
	}

	if (signer.address == tokenRegistryOwner) {
		console.log("Adding item...")
		await waitForTransaction(async (txArgs: TransactionArgs) => {
			return tokenRegistry.addItem(
				ITEM_CATEGORY.RESERVE,
				ESTIMATOR_CATEGORY.DEFAULT_ORACLE,
				deployedContracts[network].weth,
				txArgs
			)
		}, signer)

		console.log("Adding item...")
		await waitForTransaction(async (txArgs: TransactionArgs) => {
			return tokenRegistry.addItem(
				ITEM_CATEGORY.RESERVE,
				ESTIMATOR_CATEGORY.CHAINLINK_ORACLE,
				deployedContracts[network].susd,
				txArgs
			)
		}, signer)

		console.log("Adding item...")
		await waitForTransaction(async (txArgs: TransactionArgs) => {
			return tokenRegistry.addItemDetailed(
				ITEM_CATEGORY.RESERVE,
				ESTIMATOR_CATEGORY.BLOCKED,
				'0xffffffffffffffffffffffffffffffffffffffff', //virtual item
				{
					adapters: [synthetixAdapterAddress, synthRedeemerAdapterAddress],
					path: [],
					cache: '0x'
				},
				hre.ethers.constants.AddressZero,
				txArgs
			)
		}, signer)

		console.log("Adding item...")
		await waitForTransaction(async (txArgs: TransactionArgs) => {
			return tokenRegistry.addItem(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.BLOCKED,
				'0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E', //TUSD second address
				txArgs
			)
		}, signer)

		console.log("Adding item...")
		await waitForTransaction(async (txArgs: TransactionArgs) => {
			return tokenRegistry.addItem(
				ITEM_CATEGORY.BASIC,
				ESTIMATOR_CATEGORY.BLOCKED,
				'0xcA3d75aC011BF5aD07a98d02f18225F9bD9A6BDF', //tricrypto, depreciated for tricrypto2
				txArgs
			)
		}, signer)
	}

	if (owner != signer.address && signer.address == whitelistOwner) {
		console.log("Transfering Whitelist...")
		await waitForTransaction(async (txArgs: TransactionArgs) => {
			return whitelist.transferOwnership(owner, txArgs)
		}, signer)
	}

	if (signer.address == tokenRegistryOwner) {
		console.log("Transfering TokenRegistry...")
		await waitForTransaction(async (txArgs: TransactionArgs) => {
			return tokenRegistry.transferOwnership(factoryAddress, txArgs)
		}, signer)
	}

	write2File()
}

const write2File = () => {
	const data = JSON.stringify({ ...deployments, [network]: contracts }, null, 2)
	fs.writeFileSync('./deployments.json', data)
}

const add2Deployments = (contractTitle: string, address: string) => {
	contracts[contractTitle] = address
	console.log(contractTitle + ': ' + address)
	write2File()
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
