import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import hre from "hardhat";
import { BigNumber, Contract, Signer, constants } from "ethers";
import { impersonateWithEth } from "./mainnet";
import {
  waitForTransaction,
  formatProtocol,
  TokenRegistryItem,
  TransactionArgs,
  write2File
} from "./common";
import { getLiveContracts } from "../../lib/mainnet";
import { registeredTokens, tokens } from "./jsonData";

dotenvConfig({ path: resolve(__dirname, "./.env") });

// How many tokens to add to registry per transaction
const MAX_BATCH = 200;

class EnsoTokenRegistry {
  factory: Contract;
  registry: Contract;
  isFactoryOwner: boolean;
  signer: Signer;
  totalGas: BigNumber;
  added: TokenRegistryItem[];

  constructor(factory: Contract, registry: Contract, isFactoryOwner: boolean, signer: Signer) {
    this.factory = factory;
    this.registry = registry;
    this.isFactoryOwner = isFactoryOwner;
    this.signer = signer;
    this.totalGas = hre.ethers.BigNumber.from('0')
    this.added = registeredTokens;
  }

  async registerTokens(tokenList: string[]): Promise<TokenRegistryItem[]> {
    console.log("Currently registered: ", this.added.length)
    console.log("Registry: ", this.registry.address)
    let filteredTokens = (await Promise.all(
      tokenList
        .map(token => {
          const [itemCategory, estimatorCategory] = formatProtocol(tokens[token].protocol)
          return {
            token,
            itemCategory,
            estimatorCategory,
            estimator: undefined,
            registered: undefined
          }
        })
        .filter(item => item.itemCategory > 0 || item.estimatorCategory > 0)
        .map(async (item) => {
          const registered = await this.isRegistered(item.token)
          return {
            ...item,
            registered
          }
        })
    )).filter(item => !item.registered)
    console.log("Token needing registering: ", filteredTokens.length)
    filteredTokens = (await Promise.all(
      filteredTokens
        .map(async (item) => {
          const estimator = await this.registry.estimators(item.estimatorCategory)
          return {
            ...item,
            estimator
          }
        }))
    ).filter(item => item.estimator !== hre.ethers.constants.AddressZero)
    console.log("About to register", filteredTokens.length, "tokens...")

    const items = filteredTokens.map(item => item.token)
    const itemCategories = filteredTokens.map(item => item.itemCategory)
    const estimatorCategories = filteredTokens.map(item => item.estimatorCategory)
    console.log("estimator categories: ", estimatorCategories)

    while (items.length > MAX_BATCH) {
      console.log("Adding tokens to registry. ", items.length, " remaining");
      try {
        const gasUsed = await this.registerItems(
            itemCategories.splice(itemCategories.length - MAX_BATCH, MAX_BATCH),
            estimatorCategories.splice(estimatorCategories.length - MAX_BATCH, MAX_BATCH),
            items.splice(items.length - MAX_BATCH, MAX_BATCH)
        )
        this.totalGas = this.totalGas.add(gasUsed)
        console.log("Total gas: ", this.totalGas.toString())
      } catch (err) {
        console.log(err);
      }
    }

    if (items.length > 0) {
      console.log("Adding tokens to registry. ", items.length, " remaining");
      const gasUsed = await this.registerItems(
          itemCategories,
          estimatorCategories,
          items
      )
      this.totalGas = this.totalGas.add(gasUsed)
      console.log("Total gas: ", this.totalGas.toString())
    }

    const registeredItems: TokenRegistryItem[] = filteredTokens.map(
      token => [token.itemCategory, token.estimatorCategory, token.token]
    )
    this.added.push(...registeredItems)
    return registeredItems;
  }

  async isRegistered(token: string): Promise<Boolean> {
    return (await this.registry.estimatorCategories(token)).gt(0);
  }

  async registerItems(itemCategories: number[], estimatorCategories: number[], items: string[]): Promise<number> {
    const gasUsed = await waitForTransaction(async (txArgs: TransactionArgs) => {
      if (this.isFactoryOwner) {
        return this.factory.addItemsToRegistry(
          itemCategories,
          estimatorCategories,
          items,
          txArgs
        );
      } else {
        return this.registry.addItems(
          itemCategories,
          estimatorCategories,
          items,
          txArgs
        );
      }
    }, this.signer)
    return gasUsed;
  }
}


//export async function registerTokens() {
async function main() {
  let [signer] = await hre.ethers.getSigners();
  const enso = getLiveContracts(signer)
  const registryOwnerAddress = await enso.platform.oracles.registries.tokenRegistry.owner()

  let isFactoryOwner: boolean
  let ownerAddress: string
  if (registryOwnerAddress == enso.platform.strategyFactory.address) {
    ownerAddress = await enso.platform.strategyFactory.owner()
    isFactoryOwner = true
  } else {
    ownerAddress = registryOwnerAddress
    isFactoryOwner = false
  }
  if (hre.network.name !== 'mainnet') {
    signer = await impersonateWithEth(ownerAddress, BigNumber.from(constants.WeiPerEther.mul(10)))
    console.log("Network: ",hre.network.name, "\n ==> Impersonating owner: ", signer.address, "\n\n")
  }
  const registry = new EnsoTokenRegistry(
    enso.platform.strategyFactory.connect(signer),
    enso.platform.oracles.registries.tokenRegistry.connect(signer),
    isFactoryOwner,
    signer
  );
  const tokenList = Object.keys(tokens);
  console.log('Total tokens: ', tokenList.length)
  await registry.registerTokens(tokenList)
  write2File("./tokens_registered.json", registry.added);
  console.log("\n\n[Success] Total tokens currently registered: ", registry.added.length, " tokens. Saved at: tokens_registered.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
