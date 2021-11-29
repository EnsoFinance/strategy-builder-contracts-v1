"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = __importDefault(require("dotenv"));
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("solidity-coverage");
require("@typechain/hardhat");
require("./tasks/accounts");
require("./tasks/clean");
dotenv_1.default.config();
var chainIds = {
    ganache: 1337,
    goerli: 5,
    hardhat: 31337,
    kovan: 42,
    mainnet: 1,
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
            chainId: chainIds.mainnet,
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
                blockNumber: 13500000,
            };
    }
    if (mnemonic && infuraApiKey) {
        networks.goerli = createTestnetConfig('goerli');
        networks.kovan = createTestnetConfig('kovan');
        networks.rinkeby = createTestnetConfig('rinkeby');
        networks.ropsten = createTestnetConfig('ropsten');
    }
    return networks;
}
function createTestnetConfig(network) {
    // Ensure that we have all the environment variables we need.
    var url = 'https://' + network + '.infura.io/v3/' + infuraApiKey;
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
};
exports.default = config;
