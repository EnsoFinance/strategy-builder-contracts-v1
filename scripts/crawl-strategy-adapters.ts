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

const deprecated: string[] = Object.keys(contracts).filter((contractKey: string) => contractKey.includes('_DEPRECATED'))
console.log('Deprecated: ', deprecated)
const deprecatedAddresses = deprecated.map((contractKey: string) => contracts[contractKey])

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
         const intersection = tradeData.adapters.filter((adapter: string) => deprecatedAddresses.includes(adapter))
         if (intersection.length > 0) {
           console.log("Update strategy: ", strategies[i].address)
           console.log("Intersection: ", intersection)
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
