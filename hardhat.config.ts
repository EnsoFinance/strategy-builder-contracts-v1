import { HardhatUserConfig } from 'hardhat/types'
import { NetworkUserConfig } from 'hardhat/types'
import { NetworksUserConfig } from 'hardhat/types'
import dotenv from 'dotenv'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-ethers'
import 'solidity-coverage'
import './tasks/accounts'
import './tasks/clean'
import './tasks/addOwnerFunds'
import './tasks/addContractsToDefenderAdmin'

dotenv.config()

const chainIds = {
	ganache: 1337,
	goerli: 5,
	hardhat: 31337,
	kovan: 42,
	mainnet: 1,
	ensonet: 1,
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
			chainId: chainIds.mainnet
		},
		localhost: {
			url: 'http://127.0.0.1:8545',
			timeout: 900000,
			gasPrice: 100000000000, // 100 gwei
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
				blockNumber: 14619730,
			}
	}
	if (mnemonic && infuraApiKey) {
		networks.goerli = createTestnetConfig('goerli')
		networks.kovan = createTestnetConfig('kovan')
		networks.rinkeby = createTestnetConfig('rinkeby')
		networks.ropsten = createTestnetConfig('ropsten')
		networks.ensonet = createTestnetConfig('ensonet')
		networks.mainnet = createTestnetConfig('mainnet')
	}
	return networks
}

function createTestnetConfig(network: keyof typeof chainIds): NetworkUserConfig {
	// Ensure that we have all the environment variables we need.

	let url: string
	if (network === 'ensonet') {
		url = 'http://testnet.enso.finance'
	} else {
		url = 'https://' + network + '.infura.io/v3/' + infuraApiKey
	}

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
				version: '0.8.11',
				settings: {
					optimizer: {
						enabled: true,
						runs: 20,
					},
				},
			},
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
		overrides: {
			"@uniswap/v3-periphery/contracts/libraries/ChainId.sol": {
			version: '0.7.0',
			settings: {}
			},
			"@uniswap/lib/contracts/libraries/SafeERC20Namer.sol": {
			version: '0.5.0',
			settings: {}
			},
			"@uniswap/lib/contracts/libraries/AddressStringUtil.sol": {
			version: '0.5.0',
			settings: {}
			},
			"@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol": {
			version: '0.5.0',
			settings: {}
			},
			"@uniswap/v2-periphery/contracts/interfaces/IWETH.sol": {
			version: '0.5.0',
			settings: {}
			},
			"@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol": {
			version: '0.5.0',
			settings: {}
			},
			"@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol": {
			version: '0.5.0',
			settings: {}
			},
			"@uniswap/v2-core/contracts/interfaces/IUniswapV2ERC20.sol": {
			version: '0.5.0',
			settings: {}
			},
			"@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol": {
			version: '0.5.0',
			settings: {}
			},
		}
	},
	mocha: {
		timeout: 80000,
	},
}

export default config
