import { expect } from 'chai'
import { loadFixture } from 'ethereum-waffle'
import { portfolioFactoryFixture } from './fixtures'

describe('PortfolioFactory', () => {
  it('construct', async () => {
    const { portfolioFactory } = await loadFixture(portfolioFactoryFixture)

  })
})
