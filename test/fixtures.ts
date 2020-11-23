import { Wallet } from 'ethers'
import { deployContract } from 'ethereum-waffle'

import PortfolioJSON from '../build/Portfolio.json'
import { Portfolio } from '../build/types/Portfolio'

import PortfolioFactoryJSON from '../build/PortfolioFactory.json'
import { PortfolioFactory } from '../build/types/PortfolioFactory'

export async function portfolioFixture([wallet]: Wallet[]) {
  const portfolio = (await deployContract(wallet, PortfolioJSON, [wallet.address])) as Portfolio
  return { portfolio }
}

export async function portfolioFactoryFixture([wallet]: Wallet[]) {
  const portfolioFactory = (await deployContract(wallet, PortfolioFactoryJSON)) as PortfolioFactory
  return { portfolioFactory }
}
