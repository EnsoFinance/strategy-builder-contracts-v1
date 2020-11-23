import { loadFixture } from 'ethereum-waffle'
import { portfolioFactoryFixture } from './fixtures'

describe('PortfolioFactory', () => {
  it('construct', async () => {
    await loadFixture(portfolioFactoryFixture)
  })
})
