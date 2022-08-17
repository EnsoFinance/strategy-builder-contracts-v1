import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import * as fs from "fs";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract, Signer } from "ethers";
import {
  waitForTransaction,
  TokenRegistryItem,
  TransactionArgs,
  write2File
} from "./common";
import { EnsoBuilder } from "../../lib/enso"
import {
  ESTIMATOR_CATEGORY,
  ITEM_CATEGORY
} from "../../lib/constants";
import TokenRegistry from "../../artifacts/contracts/oracles/registries/TokenRegistry.sol/TokenRegistry.json";
import StrategyProxyFactory from "../../artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json";
import { registeredTokens } from "./jsonData";

dotenvConfig({ path: resolve(__dirname, "./.env") });

// How many tokens to add to registry per transaction
const MAX_BATCH = 200;

let deployments: any;
const deploymentsPath: string | undefined = process.env.DEPLOYMENTS_PATH;
if (deploymentsPath)
  deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));

const tokensToRegister = [
  {
    token: "0x2ba592F78dB6436527729929AAf6c908497cB200",
    itemCategory: ITEM_CATEGORY.BASIC,
    estimatorCategory: ESTIMATOR_CATEGORY.CHAINLINK_ORACLE
  }
]

class EnsoTokenRegistry {
  factory: Contract;
  registry: Contract;
  signer: Signer;
  totalGas: BigNumber;
  added: TokenRegistryItem[];

  constructor(factory: Contract, registry: Contract, signer: Signer) {
    this.factory = factory;
    this.registry = registry;
    this.signer = signer;
    this.totalGas = hre.ethers.BigNumber.from('0')
    this.added = registeredTokens;
  }

  async registerTokens(): Promise<TokenRegistryItem[]> {
    console.log("Currently registered: ", this.added.length)
    let filteredTokens = (await Promise.all(
      tokensToRegister
        .map(async (item) => {
          const estimator = await this.registry.estimators(item.estimatorCategory)
          return {
            ...item,
            estimator: estimator
          }
        }))
    ).filter(item => item.estimator !== hre.ethers.constants.AddressZero)
    console.log("About to register", filteredTokens.length, "tokens...")

    const items = filteredTokens.map(item => item.token)
    const itemCategories = filteredTokens.map(item => item.itemCategory)
    const estimatorCategories = filteredTokens.map(item => item.estimatorCategory)

    while (items.length > MAX_BATCH) {
      console.log("Adding tokens to registry. ", items.length, " remaining");
      try {
        const gasUsed = await waitForTransaction(async (txArgs: TransactionArgs) => {
          return this.factory.addItemsToRegistry(
            itemCategories.splice(itemCategories.length - MAX_BATCH, MAX_BATCH),
            estimatorCategories.splice(estimatorCategories.length - MAX_BATCH, MAX_BATCH),
            items.splice(items.length - MAX_BATCH, MAX_BATCH),
            txArgs
          );
        }, this.signer)
        this.totalGas = this.totalGas.add(gasUsed)
        console.log("Total gas: ", this.totalGas.toString())
      } catch (err) {
        console.log(err);
      }
    }

    if (items.length > 0) {
      console.log("Adding tokens to registry. ", items.length, " remaining");
      const gasUsed = await waitForTransaction(async (txArgs: TransactionArgs) => {
        return this.factory.addItemsToRegistry(
          itemCategories,
          estimatorCategories,
          items,
          txArgs
        );
      }, this.signer)
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
    return (await this.registry.estimatorCategories(token)) > 0;
  }
}

async function getRegistry(
  signer: SignerWithAddress
): Promise<EnsoTokenRegistry> {
  const network = hre.network.name;

  let registry: EnsoTokenRegistry;
  // @ts-ignore
  if (deployments && deployments[network]) {
    // @ts-ignore
    const deployedAddresses = deployments[network];

    if (!deployedAddresses.TokenRegistry) throw Error("Registry not deployed");
    if (!deployedAddresses.StrategyProxyFactory) throw Error("Factory not deployed");

    const tokenRegistryFactory = new hre.ethers.ContractFactory(
      TokenRegistry.abi,
      TokenRegistry.bytecode,
      signer
    );
    const tokenRegistry = tokenRegistryFactory.attach(deployedAddresses.TokenRegistry)

    const factoryFactory = new hre.ethers.ContractFactory(
      StrategyProxyFactory.abi,
      StrategyProxyFactory.bytecode,
      signer
    );
    const factory = factoryFactory.attach(deployedAddresses.StrategyProxyFactory)

    registry = new EnsoTokenRegistry(
      factory,
      tokenRegistry,
      signer
    );
  } else {
    if (network === "mainnet") throw Error("Not implemented yet");

    const enso = await new EnsoBuilder(signer).build();
    registry = new EnsoTokenRegistry(
      enso.platform.strategyFactory,
      enso.platform.oracles.registries.tokenRegistry,
      signer
    );
  }
  return registry;
}

export async function manualRegisterTokens() {
  const [signer] = await hre.ethers.getSigners();
  const registry = await getRegistry(signer);
  console.log('Total tokens: ', tokensToRegister.length)
  await registry.registerTokens()

  write2File("./tokens_registered.json", registry.added);
  console.log("\n\n[Success] Registered ", registry.added.length, " tokens. Saved at: tokens_registered.json");
}

/*main() // TODO write "runner"
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });*/
