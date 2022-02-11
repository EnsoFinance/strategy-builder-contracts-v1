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
import "./tasks/addOwnerFunds";

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

// Ensure that we have all the environment variables we need.
let mnemonic: string | undefined = process.env.MNEMONIC
let infuraApiKey: string | undefined = process.env.INFURA_API_KEY
let archiveNode: string | undefined = process.env.ARCHIVE_NODE

let networkIndex: number = process.argv.findIndex((arg) => arg === '--network')
if (networkIndex > 0) {
	if (process.argv[networkIndex + 1] !== 'hardhat') {
		if (!mnemonic) {
			throw new Error('Please set your MNEMONIC in a .env file')
		}
		if (!infuraApiKey) {
			throw new Error('Please set your INFURA_API_KEY in a .env file')
		}
	} else {
		if (process.argv[2] == 'test' && !archiveNode) {
			throw new Error('Please set your ARCHIVE_NODE in a .env file')
		}
	}
} else {
	if (process.argv[2] == 'test' && !archiveNode) {
		throw new Error('Please set your ARCHIVE_NODE in a .env file')
	}
}

function getNetworks(): NetworksUserConfig {
	let networks: NetworksUserConfig = {
		hardhat: {
			chainId: chainIds.mainnet,
		},
	}
	if (networks.hardhat) {
		if (mnemonic)
			networks.hardhat.accounts = {
				mnemonic,
			}
		if (archiveNode)
			networks.hardhat.forking = {
				url: archiveNode,
				blockNumber: 13777169,
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
				version: '0.7.6',
				settings: {
					optimizer: {
						enabled: true,
						runs: 20,
					},
				},
			},
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
		timeout: 80000,
	},
}

export default config
