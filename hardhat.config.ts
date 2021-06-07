/**
 * @type import('hardhat/config').HardhatUserConfig
 */
import { HardhatUserConfig } from 'hardhat/types'
import { NetworkUserConfig } from 'hardhat/types'
import { NetworksUserConfig } from 'hardhat/types'
import dotenv from 'dotenv'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-ethers'
import 'solidity-coverage'
import '@typechain/hardhat'
import './tasks/accounts'
import './tasks/clean'
// import 'hardhat-etherscan-abi'

dotenv.config()

const chainIds = {
	ganache: 1337,
	goerli: 5,
	hardhat: 31337,
	kovan: 42,
	mainnet: 1,
	rinkeby: 4,
	ropsten: 3,
}

let mnemonic: string | undefined = process.env.MNEMONIC
let infuraApiKey: string | undefined = process.env.INFURA_API_KEY

let networkIndex: number = process.argv.findIndex(arg => arg === '--network')
if (networkIndex > 0) {
	if (process.argv[networkIndex + 1] !== 'hardhat') {
		if (!mnemonic) {
			throw new Error('Please set your MNEMONIC in a .env file')
		}
		if (!infuraApiKey) {
			throw new Error('Please set your INFURA_API_KEY in a .env file')
		}
	}
}

//  let archiveNode: string;
//  if (!process.env.ARCHIVE_NODE) {
//    throw new Error("Please set your ARCHIVE_NODE url in a .env file");
//  } else {
//    archiveNode = process.env.ARCHIVE_NODE;
//  }

//  let etherscanApiKey: string;
//  if (!process.env.ETHERSCAN_API_KEY) {
//    throw new Error("Please set your ETHERSCAN_API_KEY in a .env file");
//  } else {
//    etherscanApiKey = process.env.ETHERSCAN_API_KEY;
//  }

function getNetworks(): NetworksUserConfig {
	let networks: NetworksUserConfig = {
		hardhat: {
			//  forking: {
			//    url: archiveNode,
			//    blockNumber: 12142007,
			//  },
			chainId: chainIds.mainnet,
		}
	}
	if (mnemonic && infuraApiKey) {
		networks.goerli = createTestnetConfig('goerli')
		networks.kovan = createTestnetConfig('kovan')
		networks.rinkeby = createTestnetConfig('rinkeby')
		networks.ropsten = createTestnetConfig('ropsten')
	}
	return networks
}

function createTestnetConfig(network: keyof typeof chainIds): NetworkUserConfig {
	// Ensure that we have all the environment variables we need.
	const url: string = 'https://' + network + '.infura.io/v3/' + infuraApiKey
	return {
		accounts: {
			count: 10,
			initialIndex: 0,
			mnemonic,
			path: "m/44'/60'/0'/0",
		},
		chainId: chainIds[network],
		url,
	}
}

let config: HardhatUserConfig = {
	defaultNetwork: 'hardhat',
	networks: getNetworks(),
	paths: {
		artifacts: './artifacts',
		cache: './cache',
		sources: './contracts',
		tests: './test',
	},
	solidity: {
		compilers: [
			{
				version: '0.6.12',
				settings: {
					optimizer: {
						enabled: true,
						runs: 20,
					},
				},
			},
			{
				version: '0.6.6',
				settings: {
					optimizer: {
						enabled: true,
						runs: 20,
					},
				},
			},
			{
				version: '0.5.16',
				settings: {
					optimizer: {
						enabled: true,
						runs: 20,
					},
				},
			},
			{
				version: '0.5.12',
				settings: {
					optimizer: {
						enabled: true,
						runs: 20,
					},
				},
			},
			{
				version: '0.5.5',
				settings: {
					optimizer: {
						enabled: true,
						runs: 20,
					},
				},
			},
		],
	},
	mocha: {
		timeout: 40000,
	},
	// typechain: {
	// 	outDir: 'typechain',
	// 	target: 'ethers-v5',
	// },
}

export default config
