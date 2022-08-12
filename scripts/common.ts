import hre from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, Contract } from 'ethers'
import deploymentsJSON from '../deployments.json'
const deployments: {[key: string]: {[key: string]: string}} = deploymentsJSON

const MAX_GAS_PRICE = hre.ethers.BigNumber.from('85000000000') // 85 gWEI

export const contractAliases : {[key: string]: string} = {
	'SushiSwapAdapter' : 'UniswapV2Adapter',
	'DefaultEstimator' : 'BasicEstimator',
	'ChainlinkEstimator' : 'BasicEstimator',
	'StrategyrImplementation' : 'Strategy',
	'StrategyProxyFactoryImplementation' : 'StrategyProxyFactory',
	'StrategyControllerImplementation' : 'StrategyController',
	'StrategyControllerPausedImplementation' : 'StrategyControllerPaused',
}

export type TransactionArgs = {
	maxPriorityFeePerGas: BigNumber;
	maxFeePerGas: BigNumber;
}

export class Deployer {
	signer: SignerWithAddress;
	contracts: {[key: string]: string} = {};
	network: string;
	overwrite: boolean;
	whitelistOwner: string = "";
	factoryOwner: string = "";
	tokenRegistryOwner: string = "";

	constructor(
		signer: SignerWithAddress,
		network: string,
		overwrite: boolean
	) {
		this.signer = signer;
		this.network = network;
		this.overwrite = overwrite;
  
		if (deployments[network]) this.contracts = deployments[network]
		if (network === 'mainnet') this.overwrite = false // Don't overwrite on mainnet
	}

	async updateOwners() {
		this.whitelistOwner = await this.getOwner('Whitelist')
		this.factoryOwner = await this.getOwner('StrategyProxyFactory')
		this.tokenRegistryOwner = await this.getOwner('TokenRegistry')
	}

	async getContract(contractName: string): Promise<Contract> {
		const actualContractName = contractAliases[contractName] || contractName
		return hre.ethers.getContractAt(actualContractName, this.contracts[contractName])
	}

	async getOwner(contractName: string): Promise<string> {
		if (this.contracts[contractName]) {
			const contract = await this.getContract(contractName)
			return contract.owner()
		}
		return ""
	}

	async deploy(
		contractName: string,
		params: any[],
		libraries?: {[key: string]: string}
	): Promise<Contract> {
		const actualContractName = contractAliases[contractName] || contractName
		const ContractFactory = await hre.ethers.getContractFactory(actualContractName, {
			libraries
		});
		const contract = await waitForDeployment(async (txArgs: TransactionArgs) => {
			return ContractFactory.deploy(...params, txArgs)
		}, this.signer);
		this.add2Deployments(contractName, contract.address);
    return contract
	}

	async deployOrGetContract(
		contractName: string,
		params: any[],
		libraries?: {[key: string]: string}
	): Promise<Contract> {
		if (this.overwrite || !this.contracts[contractName] ) {
			return this.deploy(contractName, params, libraries)
		} else {
			return this.getContract(contractName)
		}
	}

	async deployOrGetAddress(
		contractName: string,
		params: any[],
		libraries?: {[key: string]: string}
	): Promise<string> {
		if (this.overwrite || !this.contracts[contractName] ) {
			return (await this.deploy(contractName, params, libraries)).address
		} else {
			return this.contracts[contractName]
		}
	}

	async deployAndWhitelist(
		contractName: string,
		params: any[],
		libraries?: {[key: string]: string}
	): Promise<string> {
		const contractAddress = await this.deployOrGetAddress(contractName, params, libraries)
		if (this.signer.address === this.whitelistOwner) {
			console.log("Whitelisting...")
			const whitelist = await this.getContract('Whitelist')
			await waitForTransaction(async (txArgs: TransactionArgs) => {
				return whitelist.approve(contractAddress, txArgs)
			}, this.signer)
		}
		return contractAddress
	}

	async setupEstimators(
		uniswapOracleAddress: string,
		chainlinkOracleAddress: string
	) {
    let contractHandle : Contract 
    let fnPtr : (estimatorCategory: number, estimatorAddress: string, txArgs: TransactionArgs) => void = (estimatorCategory: number, estimatorAddress: string, txArgs: TransactionArgs) => {} // Noop
		if (this.signer.address == this.tokenRegistryOwner) {
        contractHandle = await this.getContract('TokenRegistry')
        fnPtr = contractHandle.addEstimator
    } else if (this.signer.address == this.factoryOwner)  {
        contractHandle = await this.getContract('StrategyProxyFactory')
				fnPtr = contractHandle.addEstimatorToRegistry
    } else {
        return;
    }
    await setupEstimatorsWithFunc(
      uniswapOracleAddress,
      chainlinkOracleAddress,
      (estimatorCategory: number, estimatorAddress: string) => {
					console.log("Adding estimator...")
					await waitForTransaction(async (txArgs: TransactionArgs) => {
						return fnPtr(estimatorCategory, estimatorAddress, txArgs)
					}, this.signer)
		  }
    )
	}

	async setupEstimatorsWithFunc(
		uniswapOracleAddress: string,
		chainlinkOracleAddress: string,
		registerEstimator: (estimatorCategory: number, estimatorAddress: string) => void
	) {
		await deployer.setupEstimator(ESTIMATOR_CATEGORY.DEFAULT_ORACLE, 'DefaultEstimator', [
			uniswapOracleAddress
		], registerEstimator)
		await deployer.setupEstimator(ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, 'ChainlinkEstimator', [
			chainlinkOracleAddress
		], registerEstimator)
		await deployer.setupEstimator(ESTIMATOR_CATEGORY.STRATEGY, 'StrategyEstimator', [], registerEstimator)
		await deployer.setupEstimator(ESTIMATOR_CATEGORY.BLOCKED, 'EmergencyEstimator', [], registerEstimator)
		await deployer.setupEstimator(ESTIMATOR_CATEGORY.AAVE_V2, 'AaveV2Estimator', [], registerEstimator)
		// this.add2Deployments('AaveEstimator', aaveV2Estimator.address) //Alias
		await deployer.setupEstimator(ESTIMATOR_CATEGORY.AAVE_V2_DEBT, 'AaveV2DebtEstimator', [], registerEstimator)
		// this.add2Deployments('AaveDebtEstimator', aaveV2DebtEstimator.address) //Alias
		await deployer.setupEstimator(ESTIMATOR_CATEGORY.COMPOUND, 'CompoundEstimator', [], registerEstimator)
		await deployer.setupEstimator(ESTIMATOR_CATEGORY.CURVE_LP, 'CuveLPEstimator', [], registerEstimator)
		// this.add2Deployments('CurveEstimator', curveLPEstimator.address) //Alias
		await deployer.setupEstimator(ESTIMATOR_CATEGORY.CURVE_GAUGE, 'CurveGaugeEstimator', [], registerEstimator)
		await deployer.setupEstimator(ESTIMATOR_CATEGORY.YEARN_V2, 'YEarnV2Estimator', [], registerEstimator)
	}

	async setupEstimator(
		estimatorCategory: number,
		contractName: string,
		params: any[],
		registerEstimator: (estimatorCategory: number, estimatorAddress: string) => void
	) {
		const estimatorAddress = await deployOrGetAddress(contractName, params)
		await registerEstimator(estimatorCategory, estimatorAddress)
	}

	write2File() {
		const data = JSON.stringify({ ...deployments, [this.network]: this.contracts }, null, 2)
		fs.writeFileSync('./deployments.json', data)
	}

	add2Deployments(contractName: string, address: string) {
		this.contracts[contractName] = address
		console.log(contractName + ': ' + address)
		this.write2File()
	}
}

export const waitForDeployment = async (
	txFunc: (txArgs: TransactionArgs) => Promise<Contract>,
	signer: any
) => {
	return new Promise<Contract>(async (resolve) => {
		let isDeployed = false
		while (!isDeployed) {
			const tip = await waitForLowGas(signer);
			let contract: Contract
			try {
					contract = await txFunc({
						maxPriorityFeePerGas: tip,
						maxFeePerGas: MAX_GAS_PRICE
					})
					await contract.deployed()
					isDeployed = true;
			} catch (e: any) {
					if (e.toString().includes('max fee per gas less than block base fee')) {
						//try again
						console.log(e);
						continue;
					} else {
						throw new Error(e);
					}
			}
			const receipt = await contract.deployTransaction.wait()
			const gasUsed = receipt.gasUsed;
			console.log("Gas used: ", gasUsed.toString())
			resolve(contract)
		}

	});
}

export const waitForTransaction = async (
	txFunc: (txArgs: TransactionArgs) => Promise<any>,
	signer: any
) => {
	return new Promise<any>(async (resolve) => {
		let isCalled = false
		while (!isCalled) {
			const tip = await waitForLowGas(signer);
			let receipt: any
			try {
					const tx = await txFunc({
						maxPriorityFeePerGas: tip,
						maxFeePerGas: MAX_GAS_PRICE
					})
					receipt = await tx.wait()
					isCalled = true;
			} catch (e: any) {
					if (e.toString().includes('max fee per gas less than block base fee')) {
						//try again
						console.log(e);
						continue;
					} else {
						throw new Error(e);
					}
			}
			const gasUsed = receipt.gasUsed;
			console.log("Gas used: ", gasUsed.toString())
			resolve(receipt)
		}
	});
}

export const waitForLowGas = async (signer: any) => {
  return new Promise<any>(async (resolve) => {
    const blockNumber = await hre.ethers.provider.getBlockNumber()
    //console.log('Next Block: ', blockNumber + 1)
    const [ block, feeData ] = await Promise.all([
      hre.ethers.provider.getBlock(blockNumber),
      signer.getFeeData()
    ])
    const expectedBaseFee = getExpectedBaseFee(block)
    if (expectedBaseFee.eq('0')) {
        console.log('Bad block. Waiting 15 seconds...');
        setTimeout(async () => {
          tip = await waitForLowGas(signer);
          resolve(tip);
        }, 15000);
    }
    // Pay 5% over expected tip
    let tip = feeData.maxPriorityFeePerGas.add(feeData.maxPriorityFeePerGas.div(20))
    const estimatedGasPrice = expectedBaseFee.add(tip)
    //console.log('Expected Base Fee: ', expectedBaseFee.toString())
    //console.log('Estimated Gas Price: ', estimatedGasPrice.toString())
    if (estimatedGasPrice.gt(MAX_GAS_PRICE)) {
        console.log('Gas too high. Waiting 15 seconds...');
        setTimeout(async () => {
          tip = await waitForLowGas(signer);
          resolve(tip);
        }, 15000);
    } else {
        resolve(tip);
    }
  });
}

export const getExpectedBaseFee = (block: any) => {
  let expectedBaseFee = hre.ethers.BigNumber.from('0')
  if (block.baseFeePerGas) {
    const target = block.gasLimit.div(2)
    if (block.gasUsed.gt(target)) {
        const diff = block.gasUsed.sub(target);
        expectedBaseFee = block.baseFeePerGas.add(block.baseFeePerGas.mul(1000).div(8).mul(diff).div(target).div(1000))
    } else {
        const diff = target.sub(block.gasUsed);
        expectedBaseFee = block.baseFeePerGas.sub(block.baseFeePerGas.mul(1000).div(8).mul(diff).div(target).div(1000))
    }
  }
  return expectedBaseFee
}
