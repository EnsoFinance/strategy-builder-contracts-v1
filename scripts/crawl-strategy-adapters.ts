import hre from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import Strategy from '../artifacts/contracts/Strategy.sol/Strategy.json'
import StrategyProxyFactory from '../artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json'
//import { write2File} from "./common"
import deploymentsJSON from '../deployments.json'

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

async function crawlStrategies(factory: Contract, signer: SignerWithAddress) {
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
          console.log("\nUpdate strategy: ", strategies[i].address)
          console.log("Strategy Manager", await strategies[i].manager())
          const adapters = tradeData.adapters.map((adapter: string) => {
            const newAdapter = addressMapping[adapter]
            if (newAdapter) {
              return newAdapter
            } else {
              return adapter
            }
          })
          console.log('Old adapters: ', tradeData.adapters)
          console.log('New adapters: ', adapters)
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

async function main() {
    const [ signer ] = await hre.ethers.getSigners();

    const factory = new hre.ethers.Contract(contracts['StrategyProxyFactory'], StrategyProxyFactory.abi, signer);
    await crawlStrategies(factory, signer);
    //write2File("uni_v3_pairs.json", tokenlist);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
