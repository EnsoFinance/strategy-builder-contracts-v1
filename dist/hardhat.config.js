"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = __importDefault(require("dotenv"));
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("solidity-coverage");
require("./tasks/accounts");
require("./tasks/clean");
require("./tasks/addOwnerFunds");
require("./tasks/addContractsToDefenderAdmin");
dotenv_1.default.config();
var chainIds = {
    ganache: 1337,
    goerli: 5,
    hardhat: 31337,
    kovan: 42,
    mainnet: 1,
    ensonet: 1,
    rinkeby: 4,
    ropsten: 3,
};
// Ensure that we have all the environment variables we need.
var mnemonic = process.env.MNEMONIC;
var infuraApiKey = process.env.INFURA_API_KEY;
var archiveNode = process.env.ARCHIVE_NODE;
var networkIndex = process.argv.findIndex(function (arg) { return arg === '--network'; });
if (networkIndex > 0) {
    if (process.argv[networkIndex + 1] !== 'hardhat') {
        if (!mnemonic) {
            throw new Error('Please set your MNEMONIC in a .env file');
        }
        if (!infuraApiKey) {
            throw new Error('Please set your INFURA_API_KEY in a .env file');
        }
    }
    else {
        if (process.argv[2] == 'test' && !archiveNode) {
            throw new Error('Please set your ARCHIVE_NODE in a .env file');
        }
    }
}
else {
    if (process.argv[2] == 'test' && !archiveNode) {
        throw new Error('Please set your ARCHIVE_NODE in a .env file');
    }
}
function getNetworks() {
    var networks = {
        hardhat: {
            chainId: chainIds.mainnet
        },
        localhost: {
            url: 'http://127.0.0.1:8545',
            timeout: 900000,
            gasPrice: 100000000000, // 100 gwei
        },
    };
    if (networks.hardhat) {
        if (mnemonic)
            networks.hardhat.accounts = {
                mnemonic: mnemonic,
            };
        if (archiveNode)
            networks.hardhat.forking = {
                url: archiveNode,
                blockNumber: 14619730,
            };
    }
    if (mnemonic && infuraApiKey) {
        networks.goerli = createTestnetConfig('goerli');
        networks.kovan = createTestnetConfig('kovan');
        networks.rinkeby = createTestnetConfig('rinkeby');
        networks.ropsten = createTestnetConfig('ropsten');
        networks.ensonet = createTestnetConfig('ensonet');
        networks.mainnet = createTestnetConfig('mainnet');
    }
    return networks;
}
function createTestnetConfig(network) {
    // Ensure that we have all the environment variables we need.
    var url;
    if (network === 'ensonet') {
        url = 'http://testnet.enso.finance';
    }
    else {
        url = 'https://' + network + '.infura.io/v3/' + infuraApiKey;
    }
    return {
        accounts: {
            count: 10,
            initialIndex: 0,
            mnemonic: mnemonic,
            path: "m/44'/60'/0'/0",
        },
        chainId: chainIds[network],
        url: url,
    };
}
var config = {
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
};
exports.default = config;
