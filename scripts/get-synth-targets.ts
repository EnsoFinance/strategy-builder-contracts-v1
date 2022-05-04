import hre from 'hardhat'
import { ITEM_CATEGORY, ESTIMATOR_CATEGORY } from "../lib/constants"

const synths = [
  "0x57ab1ec28d129707052df4df418d58a2d46d5f51",
  "0xd2dF355C19471c8bd7D8A3aa27Ff4e26A21b4076",
  "0xF48e200EAF9906362BB1442fca31e0835773b8B4",
  "0xfE18be6b3Bd88A2D2A7f928d00292E7a9963CfC6",
  "0xe36E2D3c7c34281FA3bC737950a68571736880A1",
  "0xbBC455cb4F1B9e4bFC4B73970d360c8f032EfEE6",
  "0xe1aFe1Fd76Fd88f78cBf599ea1846231B8bA3B6B",
  "0x5e74C9036fb86BD7eCdcb084a0673EFc32eA31cb",
  "0xD71eCFF9342A5Ced620049e616c5035F1dB98620",
  "0xF6b1C627e95BFc3c1b4c9B825a032Ff0fBf3e07d",
  "0x1715AC0743102BF5Cd58EfBB6Cf2dC2685d967b6",
  "0x97fe22E7341a0Cd8Db6F6C021A24Dc8f4DAD855F",
  "0x269895a3dF4D73b077Fc823dD6dA1B95f72Aaf9B",
  "0x0F83287FF768D1c1e17a42F44d644D7F22e8ee1d"
]

const targets: string[] = []
async function main() {
  for (let i = 0; i < synths.length; i++) {
    const synth = await hre.ethers.getContractAt('ISynth', synths[i])
    const target = await synth.target()
    targets.push(target)
  }
  console.log("Item categories")
  const items = new Array(targets.length).fill(ITEM_CATEGORY.BASIC)
  console.log(items)
  console.log("Estimator categories")
  const estimators = new Array(targets.length).fill(ESTIMATOR_CATEGORY.BLOCKED)
  console.log(estimators)
  console.log("Target addresses")
  console.log(targets)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
