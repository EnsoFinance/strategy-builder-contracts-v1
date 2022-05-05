import hre from "hardhat";
import dotenv from "dotenv"
import { Contract, Wallet } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import Strategy from '../artifacts/contracts/Strategy.sol/Strategy.json'
import StrategyProxyFactory from '../artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json'
import { waitForTransaction } from "./common"
import deploymentsJSON from '../deployments.json'

dotenv.config()

let privateKey: string | undefined = process.env.PRIVATE_KEY

const deployments: {[key: string]: {[key: string]: string}} = deploymentsJSON
let contracts: {[key: string]: string} = {}
if (deployments['mainnet']) contracts = deployments['mainnet']

const addressMapping: {[key: string]: string} = {}
const deprecated: string[] = Object.keys(contracts).filter(
  (contractKey: string) => contractKey.includes('_DEPRECATED')
)

deprecated.map((deprecatedKey: string) => {
  const contractKey = deprecatedKey.replace("_DEPRECATED", "")
  addressMapping[contracts[deprecatedKey]] = contracts[contractKey]
})

async function crawlStrategies(factory: Contract, signer: SignerWithAddress | Wallet) {
    const filter = factory.filters.NewStrategy()
    const events = await factory.queryFilter(filter);
    let strategies = events.map((event) => {
      const strategyAddress = event?.args?.strategy;
      return new Contract(strategyAddress, Strategy.abi, signer)
    })

    for (let i = 0; i < strategies.length; i++) {
      const items = await strategies[i].items()
      for (let j = 0; j < items.length; j++) {
        const tradeData = await strategies[i].getTradeData(items[j])
        const intersection = tradeData.adapters.filter((adapter: string) => addressMapping[adapter] !== undefined)
        if (intersection.length > 0) {
          const manager = await strategies[i].manager()
          const adapters = tradeData.adapters.map((adapter: string) => {
            const newAdapter = addressMapping[adapter]
            if (newAdapter) {
              return newAdapter
            } else {
              return adapter
            }
          })
          console.log('\nStrategy: ', strategies[i].address)
          console.log('Old adapters: ', tradeData.adapters)
          console.log('New adapters: ', adapters)
          if (signer.address == manager) {
            console.log("\nUpdating strategy...")
            await waitForTransaction(async (txArgs) => {
              return strategies[i].updateTradeData(
                items[j],
                {
                 adapters: adapters,
                 path: tradeData.path,
                 cache: tradeData.cache
                },
                txArgs
              )
            }, signer)
            console.log("Success!")
          } else {
            console.log("\nUpdate needed!")
            console.log("Strategy Manager", manager)
            const encoding = strategies[i].interface.encodeFunctionData('updateTradeData', [
              items[j],
              {
               adapters: adapters,
               path: tradeData.path,
               cache: tradeData.cache
              }
            ])
            console.log("\nEncoding: ", encoding)
          }
        }
      }
    }
}

async function main() {
    //const [ signer ] = await hre.ethers.getSigners();
    if (privateKey) {
      const signer = new hre.ethers.Wallet(privateKey, hre.ethers.provider)
      console.log("Signer: ", signer.address)
      const factory = new hre.ethers.Contract(contracts['StrategyProxyFactory'], StrategyProxyFactory.abi, signer);
      await crawlStrategies(factory, signer);
    } else {
      console.log("Private key not found!")
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
