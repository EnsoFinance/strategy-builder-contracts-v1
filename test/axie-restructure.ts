import chai from 'chai'
const { expect } = chai
import hre from 'hardhat'
import { ethers, waffle } from 'hardhat'

const { getContractFactory, getSigners } = ethers
import { solidity } from 'ethereum-waffle'

import { BigNumber, Contract } from 'ethers'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { 
  prepareStrategy, 
  StrategyItem, 
  encodeTransfer,
  encodeTransferFrom,
  encodeApprove,
  Multicall,
} from '../lib/encode'
import { Tokens } from '../lib/tokens'
import { ITEM_CATEGORY, ESTIMATOR_CATEGORY, TIMELOCK_CATEGORY } from '../lib/constants'
import StrategyController from '../artifacts/contracts/StrategyController.sol/StrategyController.json'
import StrategyLibrary from '../artifacts/contracts/libraries/StrategyLibrary.sol/StrategyLibrary.json'
import Strategy from '../artifacts/contracts/Strategy.sol/Strategy.json'
import EnsoOracle from '../artifacts/contracts/oracles/EnsoOracle.sol/EnsoOracle.json'
import Whitelist from '../artifacts/contracts/Whitelist.sol/Whitelist.json'
import MulticallRouter from '../artifacts/contracts/routers/MulticallRouter.sol/MulticallRouter.json'
import LoopRouter from '../artifacts/contracts/routers/LoopRouter.sol/LoopRouter.json'
import StrategyProxyFactory from '../artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json'
import ChainlinkRegistry from '../artifacts/contracts/oracles/registries/ChainlinkRegistry.sol/ChainlinkRegistry.json'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import WETH9 from '@uniswap/v2-periphery/build/WETH9.json'

chai.use(solidity)

describe('Axie Strategy Restructure', function () {
    let	weth: Contract,
        oldAXS: Contract,
        newAXS: Contract,
        accounts: SignerWithAddress[],
        multicallRouter: Contract, 
        controller: Contract,
        oracle: Contract,
        library: Contract,
        loopRouter: Contract,
        //debugUniV3Adapter: Contract,
        strategyAddress: string,
        strategyManager: SignerWithAddress,
        strategy: Contract,
        strategyItems: StrategyItem[],
        wrapper: Contract,
        tokens: Tokens,
        rebalanceThreshold: BigNumber

    before('Setup Uniswap + Factory', async function () {
        accounts = await getSigners()
        tokens = new Tokens()
        weth = new Contract(tokens.weth, WETH9.abi, accounts[0])

        oldAXS = new Contract(tokens.oldAXS, ERC20.abi, accounts[0])
        newAXS = new Contract(tokens.newAXS, ERC20.abi, accounts[0])
        strategyAddress = '0x16F7a9c3449F9C67E8c7e8F30ae1ee5D7b8Ed10d'
        strategy = new Contract(strategyAddress, Strategy.abi, accounts[0])
        const strategyManagerAddress = await strategy.manager()
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [strategyManagerAddress],
        })
        strategyManager = await ethers.getSigner(strategyManagerAddress)
        const controllerAddress = '0x173cAe63801B32752271E32147D0d2e3a77BEbE8'
        controller = new Contract(controllerAddress, StrategyController.abi, accounts[0]) 
        library = await waffle.deployContract(accounts[0], StrategyLibrary, [])

        loopRouter = new Contract('0x1777344772BD4FC4b814A788b4858C6B93fD03f2', LoopRouter.abi, accounts[0])
        multicallRouter = new Contract('0x1AbE8C0B6AB2971729e81568f56959e9d07b344d', MulticallRouter.abi, accounts[0])
        const whitelistAddress = '0x5dDB76a626d9EB03Be47f9F9B1f459E675eF8068'
        const whitelist = new Contract(whitelistAddress, Whitelist.abi, accounts[0])
        const whitelistOwnerAddress = await whitelist.owner()
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [whitelistOwnerAddress],
        })
        //const whitelistOwner = await ethers.getSigner(whitelistOwnerAddress)

        const LibraryWrapper = await getContractFactory('LibraryWrapper', {
            libraries: {
                StrategyLibrary: library.address
            }
        })
        const ensoOracleAddress = '0xa707cb7839D0303F0cF5080B7F00E922Da4Cf501'
        oracle = new Contract(ensoOracleAddress, EnsoOracle.abi, accounts[0])
        wrapper = await LibraryWrapper.deploy(oracle.address, strategyAddress)
        await wrapper.deployed()

        const strategyProxyFactoryAddress = await controller.factory()
        const strategyProxyFactory = new Contract(strategyProxyFactoryAddress, StrategyProxyFactory.abi, accounts[0])
        const strategyProxyFactoryOwnerAddress = await strategyProxyFactory.owner()

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [strategyProxyFactoryOwnerAddress],
        })
        const strategyProxyFactoryOwner = await ethers.getSigner(strategyProxyFactoryOwnerAddress)
        // TX_0
        await strategyProxyFactory.connect(strategyProxyFactoryOwner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, newAXS.address)
        let encoded_TX_0 = strategyProxyFactory.interface.encodeFunctionData('addItemToRegistry', [ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CHAINLINK_ORACLE, newAXS.address])
        console.log("encoded_TX_0")
        console.log(encoded_TX_0)

        // update chainlink registry
        const chainlinkRegistry = new Contract('0x5FBa08541A3Ae1aC019eB7D1343902D37EF7FBc9', ChainlinkRegistry.abi, accounts[0])
        const chainlinkRegistryOwnerAddress = await chainlinkRegistry.owner()
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [chainlinkRegistryOwnerAddress],
        })
        const chainlinkRegistryOwner = await ethers.getSigner(chainlinkRegistryOwnerAddress)

        // TX_1
        await chainlinkRegistry.connect(chainlinkRegistryOwner).addOracle(newAXS.address, weth.address, '0x8b4fc5b68cd50eac1dd33f695901624a4a1a0a8b', false)
        let encoded_TX_1 = chainlinkRegistry.interface.encodeFunctionData('addOracle', [newAXS.address, weth.address, '0x8b4fc5b68cd50eac1dd33f695901624a4a1a0a8b', false])
        console.log("encoded_TX_1")
        console.log(encoded_TX_1)
    })

    it('Should restructure', async function () {

        rebalanceThreshold = await strategy.rebalanceThreshold()
        // tx_0
        await controller.connect(strategyManager).updateValue(strategy.address, TIMELOCK_CATEGORY.THRESHOLD, BigNumber.from(500))
        let tx_0 = controller.interface.encodeFunctionData('updateValue', [strategy.address, TIMELOCK_CATEGORY.THRESHOLD, BigNumber.from(500)])
        console.log("tx_0")
        console.log(tx_0)
        // tx_1
        await controller.connect(strategyManager).finalizeValue(strategy.address)
        let tx_1 = controller.interface.encodeFunctionData('finalizeValue', [strategy.address]) 
        console.log("tx_1")
        console.log(tx_1)


        const oldItems = await strategy.items()
        const newPositions = [ // DUMMY to induce type 
            { token: oldAXS.address,
              percentage: BigNumber.from(1000),
              adapters: ['', ''],
              path: [],
            }
        ]
        newPositions.pop()
        for (var i=0; i<oldItems.length; i++) {
            let itemAddress = oldItems[i];
            let tradeData = await strategy.getTradeData(itemAddress)
            let percentage = await strategy.getPercentage(itemAddress)
            if (itemAddress.toLowerCase() === oldAXS.address.toLowerCase()) {
                newPositions.push({
                    token: newAXS.address,
                    percentage: percentage,
                    adapters: [tradeData.adapters[0]],
                    path: [],
                })

            } else {
                newPositions.push({
                    token: itemAddress,
                    percentage: percentage,
                    adapters: tradeData.adapters,
                    path: tradeData.path,
                })
            }

        }
        const oldSynths = await strategy.synths()
        const oldDebt = await strategy.debt()
        if (oldSynths.length>0 || oldDebt.length>0) {
            throw Error("we assume synths and debt are 0")
        }
        strategyItems = prepareStrategy(newPositions, '0xEc36e1e39551ea72a8453C42512b3647fD930db9')// address of UniswapV3Adapter
        // tx_2
        await controller.connect(strategyManager).restructure(strategy.address, strategyItems)
        let tx_2 = controller.interface.encodeFunctionData('restructure', [strategy.address, strategyItems])
        console.log("tx_2")
        console.log(tx_2)
    })

    it('Should finalize structure', async function () {
        const calls = [] as Multicall[]
        const swapperIface = new ethers.utils.Interface([
            {
                "inputs": [],
                "name": "swapToken",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ])
        const swapTokenEncoded = swapperIface.encodeFunctionData("swapToken")
        const axsBalance = await oldAXS.balanceOf(strategy.address)
        calls.push(
            encodeTransferFrom(oldAXS, strategy.address, multicallRouter.address, axsBalance)
        )
        const axieSwapperAddress = '0x73B1714FB3BFaeFA12F3707bEfcBa3205f9A1162'
        calls.push(
            encodeApprove(oldAXS, axieSwapperAddress, axsBalance)
        )
        calls.push(
            { target: axieSwapperAddress,
              callData: swapTokenEncoded 
            }
        )
        calls.push(
            encodeTransfer(newAXS, strategy.address, axsBalance)
        )
        const data = await multicallRouter.encodeCalls(calls)

        // tx_3
        await controller
        .connect(strategyManager)
        .finalizeStructure(strategy.address, multicallRouter.address, data)
        let tx_3 = controller.interface.encodeFunctionData('finalizeStructure', [
            strategy.address, multicallRouter.address, data
        ])
        console.log("tx_3")
        console.log(tx_3)

      
        // tx_4
        await controller.connect(strategyManager).updateValue(strategy.address, TIMELOCK_CATEGORY.THRESHOLD, rebalanceThreshold)
        let tx_4 = controller.interface.encodeFunctionData('updateValue', [strategy.address, TIMELOCK_CATEGORY.THRESHOLD, rebalanceThreshold])
        console.log("tx_4")
        console.log(tx_4)

        // tx_5
        await controller.connect(strategyManager).finalizeValue(strategy.address)
        let tx_5 = controller.interface.encodeFunctionData('finalizeValue', [strategy.address])
        console.log("tx_5")
        console.log(tx_5)
    })

    it('Should rebalance strategy', async function () {
        // tx_6
        const tx = await controller.connect(strategyManager).rebalance(strategy.address, loopRouter.address, '0x')
        let tx_6 = controller.interface.encodeFunctionData('rebalance', [strategy.address, loopRouter.address, '0x'])
        console.log("tx_6")
        console.log(tx_6)
        const receipt = await tx.wait()
        console.log('Gas Used: ', receipt.gasUsed.toString())
		    //await displayBalances(wrapper, strategyItems.map((item) => item.item), weth)
		    expect(await wrapper.isBalanced()).to.equal(true)
    })
})
