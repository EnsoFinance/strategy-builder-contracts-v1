import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import * as fs from "fs";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import {
  waitForTransaction,
  CurveDepositZapRegistryInfo,
  TransactionArgs
} from "./common";
import CurveDepositZapRegistry from "../../artifacts/contracts/oracles/registries/CurveDepositZapRegistry.sol/CurveDepositZapRegistry.json";
import { curveDepositZapRegistryInfo } from "./jsonData";

dotenvConfig({ path: resolve(__dirname, "./.env") });

let deployments: any;
const deploymentsPath: string | undefined = process.env.DEPLOYMENTS_PATH;
if (deploymentsPath)
  deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));


async function batchAddPools(
  curveDepositZapRegistry: Contract,
  signer: SignerWithAddress,
  chainlinkPairs: CurveDepositZapRegistryInfo[]
) {
  let totalGas = hre.ethers.BigNumber.from('0')

  const tokens = chainlinkPairs.map((t) => t.token);
  const pools = chainlinkPairs.map((t) => t.pool);
  const zaps = chainlinkPairs.map((t) => t.zap);
  const indexTypes = chainlinkPairs.map((t) => t.indexType);

  let count = 0
  for( let i = 0; i < tokens.length; i++) {
    if (pools[i] !== zaps[i] || indexTypes[i].gt(0)) {
      console.log("Adding Curve pool to registry: ", tokens[i]);
      const gasUsed = await waitForTransaction(async (txArgs: TransactionArgs) => {
        return curveDepositZapRegistry
          .connect(signer)
          .addZap(
            tokens[i],
            zaps[i],
            indexTypes[i],
            txArgs
          )
      }, signer)
      totalGas = totalGas.add(gasUsed)
      console.log("Total gas: ", totalGas.toString())
      count++
    }
  }

  return count
}

// Deploy or get (Searcher, CurveDepositZapRegistry)
async function getRegistry(
  signer: SignerWithAddress
): Promise<Contract> {
  const network = hre.network.name;

  let registry: Contract;
  // @ts-ignore
  if (deployments && deployments[network]) {
    // @ts-ignore
    const deployedAddresses = deployments[network];

    if (!deployedAddresses.CurveDepositZapRegistry) throw Error("Registry not deployed");

    const registryFactory = new hre.ethers.ContractFactory(
      CurveDepositZapRegistry.abi,
      CurveDepositZapRegistry.bytecode,
      signer
    );
    registry = registryFactory.attach(deployedAddresses.CurveDepositZapRegistry)
  } else {
    if (network === "mainnet") throw Error("Not implemented yet");

    const registryFactory = new hre.ethers.ContractFactory(
      CurveDepositZapRegistry.abi,
      CurveDepositZapRegistry.bytecode,
      signer
    );
    registry = await registryFactory.deploy();
    await registry.deployed();
  }
  return registry;
}

//export async function registerCurvePools() {
async function main() {
  const [signer] = await hre.ethers.getSigners();

  const curveDepositZapRegistry = await getRegistry(signer);

  const count = await batchAddPools(curveDepositZapRegistry, signer, curveDepositZapRegistryInfo);

  console.log(
    "\n\n[Success] Added ",
    count,
    " out of ",
    curveDepositZapRegistryInfo.length,
    " tokens."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
