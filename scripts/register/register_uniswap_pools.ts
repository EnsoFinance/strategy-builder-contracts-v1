import hre from "hardhat";
import { Contract, BigNumber, constants } from "ethers";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateWithEth } from "./mainnet"
import {
  waitForTransaction,
  TransactionArgs,
  write2File,
  AmmLiquidityInfo
} from "./common";
import { MinEthLiquidity, MaxEthLiquidity, MinTimeWindow, MaxTimeWindow } from "./config";
import { getLiveContracts } from "../../lib/mainnet";
import { uniV3Registered, uniV3ToRegister } from "./jsonData";

dotenvConfig({ path: resolve(__dirname, "./.env") });

// How many pools to add to registry per transaction
const MAX_BATCH = 5;

async function batchAddPools(
  uniV3Registry: Contract,
  signer: SignerWithAddress,
  unregisteredPairs: AmmLiquidityInfo[],
  registeredPairs: AmmLiquidityInfo[]
) {
  let totalGas = hre.ethers.BigNumber.from('0')
  const unregisteredPairsJson = unregisteredPairs.map(pair => { return {...pair, fee: Number(pair.fee.toString()) }})
  const registeredPairsJson = registeredPairs.map(pair => { return {...pair, fee: Number(pair.fee.toString()) }})

  const tokens = unregisteredPairsJson.map((t) => t.token);
  const pairs = unregisteredPairsJson.map((t) => t.pair);
  const fees = unregisteredPairsJson.map((t) => t.fee);
  const timeWindows = unregisteredPairsJson.map((t) => getTimeWindow(t.wethValue));

  while (tokens.length > MAX_BATCH) {
    console.log("Adding V3 pairs to registry. ", tokens.length, " remaining");
    const toks = tokens.splice(tokens.length - MAX_BATCH, MAX_BATCH)
    const tokPairs = pairs.splice(pairs.length - MAX_BATCH, MAX_BATCH)
    const pairFees = fees.splice(fees.length - MAX_BATCH, MAX_BATCH)
    const pairTWS = timeWindows.splice(timeWindows.length - MAX_BATCH, MAX_BATCH)
    console.log("Tokens: ", toks)
    console.log("Pairs: ", tokPairs)
    console.log("Fees: ", pairFees)
    const gasUsed = await waitForTransaction(async (txArgs: TransactionArgs) => {
      return uniV3Registry
        .connect(signer)
        .batchAddPools(
          toks,
          tokPairs,
          pairFees,
          pairTWS,
          txArgs
        )
    }, signer)
    totalGas = totalGas.add(gasUsed)
    console.log("Total gas: ", totalGas.toString())
    const newRegisteredPairs = unregisteredPairsJson.splice(unregisteredPairsJson.length - MAX_BATCH, MAX_BATCH)
    registeredPairsJson.push(...newRegisteredPairs)
    write2File("uni_v3_to_register.json", unregisteredPairsJson);
    write2File("uni_v3_registered.json", registeredPairsJson);
  }

  if (tokens.length > 0) {
    console.log("Adding V3 pairs to registry. ", tokens.length, " remaining");
    try {
      // Add remainder
      const gasUsed = await waitForTransaction(async (txArgs: TransactionArgs) => {
        return uniV3Registry.connect(signer).batchAddPools(tokens, pairs, fees, timeWindows, txArgs);
      }, signer)
      totalGas = totalGas.add(gasUsed)
      console.log("Total gas: ", totalGas.toString())
      registeredPairsJson.push(...unregisteredPairsJson);
      write2File("uni_v3_to_register.json", []);
      write2File("uni_v3_registered.json", registeredPairsJson);
    } catch (err) {
      console.log(err)
      console.log(tokens)
    }
  }
}

function getTimeWindow(wethValue: number): number {
  if (wethValue > MaxEthLiquidity) return MinTimeWindow
  const liquidityRange = MaxEthLiquidity - MinEthLiquidity
  const timeRange = MaxTimeWindow - MinTimeWindow
  const ratio = liquidityRange / timeRange
  const time = Math.round((MaxEthLiquidity - wethValue) / ratio)
  //console.log("Time window: ", MinTimeWindow + time)
  return MinTimeWindow + time
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const enso = getLiveContracts(signer)
  const uniswapV3Registry = enso.platform.oracles.registries.uniswapV3Registry
  console.log("uni v3add", uniswapV3Registry.address) // debug
  // Get registry owner
  let owner
  const ownerAddr = await uniswapV3Registry.owner()
  if (ownerAddr == signer.address) {
    owner = signer
  } else {
    owner = await impersonateWithEth(ownerAddr, BigNumber.from(constants.WeiPerEther.mul(10)))
  }
  uniswapV3Registry.connect(owner)
  await batchAddPools(uniswapV3Registry, owner, uniV3ToRegister, uniV3Registered);

  console.log(
    "\n\n[Success] Added ",
    uniV3Registered.length,
    " tokens."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
