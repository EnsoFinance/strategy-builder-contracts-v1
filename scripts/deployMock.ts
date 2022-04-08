import { constants, providers, ContractFactory, Wallet } from 'ethers'
import Factory from '@ensofinance/v1-core/contracts/artifacts/contracts/StrategyProxyFactory.sol/StrategyProxyFactory.json'

const nodeUrl = `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`
const privateKey = process.env.PRIVATE_KEY || ''
const provider = new providers.JsonRpcProvider(nodeUrl)
const wallet = new Wallet(privateKey, provider)
const factory = new ContractFactory(Factory.abi, Factory.bytecode, wallet)

async function deployFactory() {
  return await factory.deploy(
    constants.AddressZero,
    constants.AddressZero,
    constants.AddressZero,
    constants.AddressZero
  )
}

deployFactory().then(console.log).catch(console.error)
