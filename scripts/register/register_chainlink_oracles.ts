import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import * as fs from "fs";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import {
  write2File,
  waitForTransaction,
  ChainlinkRegistryInfo,
  TransactionArgs
} from "./common";
import ChainlinkRegistry from "../../artifacts/contracts/oracles/registries/ChainlinkRegistry.sol/ChainlinkRegistry.json";
import { chainlinkRegistered, chainlinkToRegister } from "./jsonData";

dotenvConfig({ path: resolve(__dirname, "./.env") });
// How many oracles to add to registry per transaction
const MAX_BATCH = 250;

let deployments: any;
const deploymentsPath: string | undefined = process.env.DEPLOYMENTS_PATH;
if (deploymentsPath)
  deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));

async function batchAddOracles(
  chainlinkRegistry: Contract,
  signer: SignerWithAddress,
  chainlinkPairs: ChainlinkRegistryInfo[]
) {
  let totalGas = hre.ethers.BigNumber.from('0')

  const tokens = chainlinkPairs.map((t) => t.token);
  const pairs = chainlinkPairs.map((t) => t.pair);
  const oracles = chainlinkPairs.map((t) => t.oracle);
  const inverses = chainlinkPairs.map((t) => t.inverse);

  while (tokens.length > MAX_BATCH) {
    console.log("Adding Chainlink oracles to registry. ", tokens.length, " remaining");
    const gasUsed = await waitForTransaction(async (txArgs: TransactionArgs) => {
      return chainlinkRegistry
          .connect(signer)
          .batchAddOracles(
            tokens.splice(tokens.length - MAX_BATCH, MAX_BATCH),
            pairs.splice(pairs.length - MAX_BATCH, MAX_BATCH),
            oracles.splice(oracles.length - MAX_BATCH, MAX_BATCH),
            inverses.splice(inverses.length - MAX_BATCH, MAX_BATCH),
            txArgs
          )
    }, signer)
    totalGas = totalGas.add(gasUsed)
    console.log("Total gas: ", totalGas.toString())
    const newRegisteredOracles = chainlinkToRegister.splice(chainlinkToRegister.length - MAX_BATCH, MAX_BATCH)
    chainlinkRegistered.push(...newRegisteredOracles)
    write2File("chainlink_oracles_to_register.json", chainlinkToRegister);
    write2File("chainlink_oracles_registered.json", chainlinkRegistered);
  }

  console.log("Adding Chainlink oracles to registry. ", tokens.length, " remaining");
  // Add remainder
  const gasUsed = await waitForTransaction(async (txArgs: TransactionArgs) => {
    return chainlinkRegistry.connect(signer).batchAddOracles(tokens, pairs, oracles, inverses, txArgs);
  }, signer)
  totalGas = totalGas.add(gasUsed)
  console.log("Total gas: ", totalGas.toString())
  chainlinkRegistered.push(...chainlinkToRegister)
  write2File("chainlink_oracles_to_register.json", []);
  write2File("chainlink_oracles_registered.json", chainlinkRegistered);
}

// Deploy or get (Searcher, ChainlinkRegistry)
async function getRegistry(
  signer: SignerWithAddress
): Promise<Contract> {
  const network = hre.network.name;

  let registry: Contract;
  // @ts-ignore
  if (deployments && deployments[network]) {
    // @ts-ignore
    const deployedAddresses = deployments[network];

    if (!deployedAddresses.ChainlinkRegistry) throw Error("Registry not deployed");

    const registryFactory = new hre.ethers.ContractFactory(
      ChainlinkRegistry.abi,
      ChainlinkRegistry.bytecode,
      signer
    );
    registry = registryFactory.attach(deployedAddresses.ChainlinkRegistry)
  } else {
    if (network === "mainnet") throw Error("Not implemented yet");

    const registryFactory = new hre.ethers.ContractFactory(
      ChainlinkRegistry.abi,
      ChainlinkRegistry.bytecode,
      signer
    );
    registry = await registryFactory.deploy();
    await registry.deployed();
  }
  return registry;
}

//export async function registerChainlinkOracles() {
async function main() {
  const [signer] = await hre.ethers.getSigners();

  const chainlinkRegistry = await getRegistry(signer);

  await batchAddOracles(chainlinkRegistry, signer, chainlinkToRegister);

  console.log(
    "\n\n[Success] Added ",
    chainlinkToRegister.length,
    " tokens."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
