const hre = require("hardhat")
const deployedContracts = require("../deployments.json")
const { preparePortfolio } = require("../test/helpers/encode")
const { wallets, portfolioNames, positions } = require("./constants/constants")

const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute

function getRandomName() {
  return portfolioNames[Math.floor(Math.random() * portfolioNames.length)]
}

function getRandomArbitrary(min, max) {
  return Math.floor(Math.random() * (max - min) + min)
}

function getRandomPosition() {
  return positions[Math.floor(Math.random() * positions.length)]
}

async function main() {
  const portfolioFactory = await hre.ethers.getContractAt(
    "PortfolioProxyFactory",
    deployedContracts[process.env.HARDHAT_NETWORK].PortfolioProxyFactory
  )
  const amount = hre.ethers.BigNumber.from("100000000000000000")

  for (const pkey of wallets) {
    let wallet = new hre.ethers.Wallet(pkey, hre.ethers.provider)

    let numberOfPortfolios = getRandomArbitrary(1, 4)

    for (let i = 0; i < numberOfPortfolios; i++) {
      const portfolioName = getRandomName()
      const position = getRandomPosition()

      let [portfolioTokens, portfolioPercentages, portfolioAdapters] = preparePortfolio(
        position,
        deployedContracts[process.env.HARDHAT_NETWORK].UniswapAdapter
      )

      const isSocial = Math.round(Math.random())
      let fee = isSocial ? 100 : 0

      let tx = await portfolioFactory
        .connect(wallet)
        .createPortfolio(
          portfolioName,
          portfolioName.substring(0, 3),
          portfolioAdapters,
          portfolioTokens,
          portfolioPercentages,
          isSocial,
          fee,
          REBALANCE_THRESHOLD,
          SLIPPAGE,
          TIMELOCK,
          { value: amount, gasLimit: 3100000 }
        )
      let receipt = await tx.wait()
      console.log("Deployment Gas Used: ", receipt.gasUsed.toString())
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
