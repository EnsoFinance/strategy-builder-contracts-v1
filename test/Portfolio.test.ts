import { expect } from 'chai';
import { deployContract, loadFixture, MockProvider } from 'ethereum-waffle';
import { portfolioFixture } from './fixtures';
import { Portfolio } from '../build/types/Portfolio'
import PortfolioJSON from '../build/Portfolio.json'
import { Contract } from 'ethers';

describe('Portfolio', () => {
  let [wallet, maliciousWallet, wallet3] = new MockProvider().getWallets();
  let portfolio: Portfolio;

  beforeEach(async () => {
    portfolio = (await deployContract(wallet, PortfolioJSON, [wallet.address])) as Portfolio
  });

  describe('setup', () => {
    it('successes with split 50/50', async () => {
      await expect(portfolio.setup([] ,[], {value: 1}))
      .to.be.revertedWith('Not yet implemented')
    });

    it('fails if non-creator', async () => {
      const shadyPortfolio = portfolio.connect(maliciousWallet)
      await expect(shadyPortfolio.setup([] ,[], {value: 1}))
        .to.be.revertedWith('Caller is not the creator')
    });

    xit('success with split 80/10/10')
    xit('fails if different array sizes')
    xit('fails if zero array size')
    xit('fails if invalid split')
    xit('fails if zero eth')
  });
      it('construct', async () => {
        expect(await portfolio.creator()).to.eq(wallet.address);
      })
})
