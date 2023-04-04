import hre from 'hardhat'
import { Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import deploymentsJSON from '../deployments.json'
import deprecatedJSON from '../deprecated.json'

const deployments: { [key: string]: { [key: string]: string } } = deploymentsJSON
const deprecated: { [key: string]: { [key: string]: string } } = deprecatedJSON

const deprecatedVersion = '1.0.10'

let network: string
let contracts: { [key: string]: string } = {}
let deprecatedContracts: { [key: string]: string } = {}
if (process.env.HARDHAT_NETWORK) {
  network = process.env.HARDHAT_NETWORK
  //ts-ignore
  if (deployments[network]) contracts = deployments[network]
  if (deprecated[deprecatedVersion]) deprecatedContracts = deprecated[deprecatedVersion]
}

const strategies = [
  /*
  {
    name: "Enso Cage Meme Index",
    address: "0x0b1281c92ea713e544ca29d7c68d9c3f5f6d4ae5",
  },
  */
  {
    name: "Enso Arch Ethereum Web3",
    address: "0x0c0dff3acb7278f9d2a8f009d8324bfd61d47114",
  },
  {
    name: "Enso NFT Platform Index",
    address: "0x16f7a9c3449f9c67e8c7e8f30ae1ee5d7b8ed10d",
  },
  {
    name: "Enso BTC 2x Flexible Leverage Index",
    address: "0x2b7bd86a2633146d6a63334b0130e756327141fa",
  },
  {
    name: "Enso ETH WBTC Yield Farm",
    address: "0x33deb629ea0fadbff489790e7fa8177c6c5c799e",
  },
  {
    name: "Enso Guttastemning",
    address: "0x3a6f78566a29a478269f93ef1600beefc8f5f36a",
  },
  {
    name: "Enso Oracle Top 5 Tokens Index",
    address: "0x4bb3b93d8e394cfe0f465a3581ae0b527ae33921",
  },
  {
    name: "Enso Potato_Swap",
    address: "0x5067c1d15467ad102e7b6fa4ab824a9b62566ff9",
  },
  {
    name: "Enso PieDAO USD++ Pool",
    address: "0x57203696a9bde98ba56b1e667841e85c2c60ce59",
  },
  {
    name: "Enso ScifiToken",
    address: "0x75deaa256730cf43ad6e12e591be77f22813ebab",
  },
  {
    name: "Enso Convex Strategies ",
    address: "0x7b5dd414e5e80f12cb29589492451f3aa989a4dd",
  },
  {
    name: "Enso ETH 2x Flexible Leverage Index",
    address: "0x81cddbf4a9d21cf52ef49bda5e5d5c4ae2e40b3e",
  },
  {
    name: "Enso SNX  Debt Pool Mirror",
    address: "0x86736159120ca443cea1424a8335a28ced370215",
  },
  {
    name: "Enso DATA Economy Index",
    address: "0x87e7a3cb9549fc88dea4d9c35a9dd47a2f53ad80",
  },
  {
    name: "Enso DefiPulse Index",
    address: "0x890ed1ee6d435a35d51081ded97ff7ce53be5942",
  },
  {
    name: "Enso Yearn Ecosystem Token Index",
    address: "0xa6a6550cbaf8ccd944f3dd41f2527d441999238c",
  },
  {
    name: "Enso Bankless BED Index",
    address: "0xaca8c8927d7bc553aeaf9d1c9ea9c1d8c88da243",
  },
  {
    name: "Enso Power Index Pool Token",
    address: "0xadd1ede9b828f23fda9da724092004c38642b5f1",
  },
  {
    name: "Enso Yearn Lazy Ape Index",
    address: "0xb41a7a429c73aa68683da1389051893fe290f614",
  },
  {
    name: "Enso Jesse Livermore Hearts Crypto",
    address: "0xb48bd102c6e318286ce1a00601ae1971fb9bee15",
  },
  {
    name: "Enso ETH USD Yield Farm",
    address: "0xb572c9a3eb3adfe72c175d6a6be3ac0051d21372",
  },
  {
    name: "Enso A-DAM Public Fund ",
    address: "0xea9e30b15248ed3cf71b95c7ffa4c61b8ec77638",
  }
]

const buildTransactions = (transactions: any[]) => {
  return {
    version: "1.0",
    chainId: "1",
    createdAt: 0,
    meta: {
      name: "Transactions Batch",
      description: "",
      txBuilderVersion: "1.10.0",
      createdFromSafeAddress: "0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F",
      checksum: "0x0"
    },
    transactions: transactions
  }
}

const updateTradeDataTx = (strategy: string, item: string, data: string) => {
  return {
    to: strategy,
    value: "0",
    data: null,
    contractMethod: {
      inputs: [
        {
          internalType: "address",
          name: "item",
          type: "address"
        }, {
          components: [
            {
              internalType: "address[]",
              name: "adapters",
              type: "address[]"
            },
            {
              internalType: "address[]",
              name: "path",
              type: "address[]"
            },
            {
              internalType: "bytes",
              name: "cache",
              type: "bytes"
            },
          ],
          internalType: "strut StrategyTypes.TradeData",
          name: "data",
          type: "tuple"
        }
      ],
      name: "updateTradeData",
      payable: false
    },
    contractInputsValues: {
      item: item,
      data: data
    }
  }
}

const upgradeTx = (admin: string, strategy: string) => {
  return {
    to: admin,
    value: "0",
    data: null,
    contractMethod:{
      inputs:[
        {
          internalType:"contract TransparentUpgradeableProxy",
          name:"proxy",
          type:"address"
        }
      ],
      name: "upgrade",
      payable: false
    },
    contractInputsValues: {
      proxy: strategy
    }
  }
}

const updateRewardsTx = (strategy: string) => {
  return {
    to: strategy,
    value: "0",
    data: null,
    contractMethod: {
      inputs:[],
      name: "updateRewards",
      payable: false
    },
    contractInputsValues: null
  }
}

const setupTradeDataTxs = async (
  strategy: Contract,
  newAdapters: string[],
  oldAdapters: string[]
) => {
  let transactions: any[] = []
  const [ items, synths, debt ] = await Promise.all([
    strategy.items(),
    strategy.synths(),
    strategy.debt()
  ])
  let assets = [...items, ...synths, ...debt]
  if (synths.length > 0) {
    assets.push('0x57ab1ec28d129707052df4df418d58a2d46d5f51') // susd
  }
  for (let i = 0; i < assets.length; i++) {
    console.log(`Looking up ${assets[i]}...`)
    let tradeData = await strategy.getTradeData(assets[i])
    let adapters = [...tradeData.adapters]
    let shouldUpdate = false
    for (let j = 0; j < adapters.length; j++) {
      for (let k = 0; k < oldAdapters.length; k++) {
        if (adapters[j].toLowerCase() == oldAdapters[k].toLowerCase()) {
          adapters[j] = newAdapters[k]
          shouldUpdate = true
        }
      }
    }
    if (shouldUpdate) {
      console.log('Found adapters that need updating!')
      const arrayifiedData = [adapters, tradeData.path, tradeData.cache]
      console.log("Item: ", assets[i])
      console.log("Data: ", arrayifiedData)
      const stringifiedData = JSON.stringify(arrayifiedData)
      const updateTradeData = updateTradeDataTx(
        strategy.address,
        assets[i],
        stringifiedData
      )
      transactions.push(updateTradeData)
    }
  }
  return transactions
}

const setupStrategyTxs = async (
    signer: SignerWithAddress,
    strategyAddress: string,
    adminAddress: string,
    newAdapters: string[],
    oldAdapters: string[]
) => {
    const strategy = await hre.ethers.getContractAt('Strategy', strategyAddress, signer)

    let transactions: any[] = []
    console.log('Get trade data txs...')
    const tradeDataTxs = await setupTradeDataTxs(strategy, newAdapters, oldAdapters)
    transactions.push(...tradeDataTxs)
    console.log('Get upgrade tx...')
    const upgrade = upgradeTx(adminAddress, strategyAddress)
    transactions.push(upgrade)
    console.log('Get rewards tx...')
    const updateRewards = updateRewardsTx(strategyAddress)
    transactions.push(updateRewards)
    return transactions
}

async function main() {
  const [signer] = await hre.ethers.getSigners()
  const strategyFactory = await hre.ethers.getContractAt('StrategyProxyFactory', contracts['StrategyProxyFactory'], signer)
  const adminAddress = await strategyFactory.admin()
  console.log("StrategyAdmin: ", adminAddress)

  const deprecatedAdaptersNames = Object.keys(deprecatedContracts).filter((name) => {
    return name.indexOf('Adapter') > -1
  })
  const newAdapters: string[] = Object.keys(contracts).filter((name) => {
    return deprecatedAdaptersNames.includes(name)
  }).map((name) => {
    return contracts[name]
  })
  const oldAdapters: string[] = deprecatedAdaptersNames.map((name) => {
    return deprecatedContracts[name]
  })

  let transactions: any[] = []
  for (let i = 0; i < strategies.length; i++) {
    console.log(`Setting up ${strategies[i].name}...`)
    const strategyTxs = await setupStrategyTxs(
      signer,
      strategies[i].address,
      adminAddress,
      newAdapters,
      oldAdapters
    )
    transactions.push(...strategyTxs)
  }
  console.log('Building multicall...')
  const multicall = buildTransactions(transactions)
  const data = JSON.stringify(multicall, null, 2)
  require('fs').writeFileSync('./txBuilder.json', data)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
