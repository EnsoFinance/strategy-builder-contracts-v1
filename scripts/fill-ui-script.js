const hre = require('hardhat')
const deployedContracts = require('../deployments.json')
const { StrategyBuilder } = require('../lib/encode')
const { wallets, strategyNames, positions } = require('./constants/constants')

const REBALANCE_THRESHOLD = 10 // 10/1000 = 1%
const SLIPPAGE = 995 // 995/1000 = 99.5%
const TIMELOCK = 60 // 1 minute

function getRandomName() {
  return strategyNames[Math.floor(Math.random() * strategyNames.length)]
}

function getRandomArbitrary(min, max) {
  return Math.floor(Math.random() * (max - min) + min)
}

function getRandomPosition() {
  return positions[Math.floor(Math.random() * positions.length)]
}

async function main() {
  const strategyFactory = await hre.ethers.getContractAt(
    'StrategyProxyFactory',
    deployedContracts[process.env.HARDHAT_NETWORK].StrategyProxyFactory
  )
  const routerAddress = deployedContracts[process.env.HARDHAT_NETWORK].LoopRouter
  const amount = hre.ethers.BigNumber.from('100000000000000000')

  for (const pkey of wallets) {
    let wallet = new hre.ethers.Wallet(pkey, hre.ethers.provider)

    let numberOfStrategys = getRandomArbitrary(1, 4)

    for (let i = 0; i < numberOfStrategys; i++) {
      const strategyName = getRandomName()
      const position = getRandomPosition()

      const s = new StrategyBuilder(position, deployedContracts[process.env.HARDHAT_NETWORK].UniswapAdapter)
      let [strategyTokens, strategyPercentages, strategyAdapters] = [s.tokens, s.percentages, s.adapters]

      const data = hre.ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])
      const isSocial = Math.round(Math.random())
      let fee = isSocial ? 100 : 0

      let tx = await strategyFactory
        .connect(wallet)
        .createStrategy(
          wallet.address,
          strategyName,
          strategyName.substring(0, 3),
          strategyTokens,
          strategyPercentages,
          isSocial,
          fee,
          REBALANCE_THRESHOLD,
          SLIPPAGE,
          TIMELOCK,
          routerAddress,
          data,
          { value: amount, gasLimit: 3100000 }
        )
      let receipt = await tx.wait()
      console.log('Deployment Gas Used: ', receipt.gasUsed.toString())
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
