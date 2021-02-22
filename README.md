# 1. Asset Management Solidity V1

Template Solidity environment based on Hardhat, Waffle, and Ethers
- [1. Asset Management Solidity V1](#1-asset-management-solidity-v1)
- [2. Getting started](#2-getting-started)
  - [2.1. Install](#21-install)
  - [2.2. Compile](#22-compile)
  - [2.3. Test](#23-test)
  - [2.4. Documentation](#24-documentation)
  - [2.5. Deploy](#25-deploy)
- [3. Contract Overview](#3-contract-overview)
  - [3.1. PortfolioProxyFactory](#31-portfolioproxyfactory)
  - [3.2. Portfolio](#32-portfolio)
  - [3.3. Routers](#33-routers)
  - [3.4. Controllers](#34-controllers)
- [4. Concepts](#4-concepts)
  - [4.1. Imbalance](#41-imbalance)
- [5. Roadmap](#5-roadmap)
- [6. Examples](#6-examples)
- [7. Kovan Deployment](#7-kovan-deployment)

# 2. Getting started

## 2.1. Install
```
npm install
```

## 2.2. Compile
```
npm run build
```

## 2.3. Test
```
npm run test
```

## 2.4. Documentation
```
npm run docs
```

## 2.5. Deploy
To deploy contracts, you must first setup the .env file. You can find a example at .env_example. Then run the following command:

```
npm run deploy <network>
```

For example, to deploy on Kovan network run `npm run deploy kovan`



# 3. Contract Overview

The asset management contracts allows users to create a rebalancing portfolio of erc20 tokens, by depositing ETH, which is swapped for the requested erc20's using decentralized exchanges and on chain time-weighted oracles.

If the eth value of any asset in the portfolio falls outside of a provided threshold range, the contract will allow rebalances, which will swap the over/under represented assets on a dex.

[Contract Documentation](https://app.gitbook.com/@ensofinance/s/enso-finance/architecture/contracts/)

## 3.1. [PortfolioProxyFactory](https://app.gitbook.com/@ensofinance/s/enso-finance/architecture/contracts/portfolioproxyfactory.sol)
- The portfolio factory deploys a proxy for all new portfolios. This contract is where protocol admin values can be set/updated.

## 3.2. [Portfolio](https://app.gitbook.com/@ensofinance/s/enso-finance/architecture/contracts/portfolio.sol)
  - Portfolios take deposits of ETH and swap it atomically for a basket of tokens, which are stored and rebalanced within the portfolio. Depositers are minted erc20 liquidity tokens redeemable for the underlying tokens of the portfolio. Portfolios can be private or public/social. If social, the creator of the portfolio has the authority to issue a restructure, with a timelock set at the creation of the portfolio, giving people time to withdraw from the portfolio.

## 3.3. Routers
  - Interface to swap tokens on different dexes


## 3.4. Controllers
  - Using the routers, the controller implements a trading strategy provided by the portfolio manager.


# 4. Concepts

## 4.1. Imbalance

The portfolio checks for an imbalance in an asset by:
```javascript
const expectedValueOfToken = portfolioValue * tokenPercentage
const estimatedValueOfToken = tokenPriceInWeth * tokenBalance
const rebalanceThreshold = expectedValueOfToken * rebalanceSlippagePercent
const imbalance = Math.abs( Math.abs(expectedValueOfToken - estimatedValueOfToken) - rebalanceThreshold)
```

# 5. Roadmap
- [x] Rebalance portfolio through DEX router
- [x] DEX Routers
  - [x] Uniswap
  - [ ] 1Inch
  - [ ] Aave
  - [ ] SushiSwap
- [x] TWP Oracle
- [x] Restructuring timelock
- [x] Generic Router: Provide Flash loans to rebalancers
- [ ] Withdraw tokens into ETH
- [ ] Generic Router: Provide optional Flash loans to depositers/withdrawls
- [ ] Yield Farming
- [ ] Alternative Portfolios
  - [ ] Prediction market outcome tokens
  - [ ] NFTs
- [ ] Gas Tokens


# 6. Examples

`Create Portfolio`

```javascript
    const { ethers } = require('hardhat')
    const { constants, getContractAt } = ether

    // Porfolio interface
    const Portfolio = await getContractFactory('Portfolio')
    const PortfolioProxyFactory = await getContractFactory('PortfolioProxyFactory')
    const portfolioFactory = await getContractAt(PortfolioProxyFactory.abi, "0xEF7B263C46343713848Db0233aCC06E5C475d85c")

    // Create new portfolio
    let tx = await portfolioFactory.createPortfolio(
      'My Portfolio',
      'Symbol',
      ["0x68f9FfF89A247a3578ABFc8d8B62584725D031d2"],  // Routers (Uni/Sushi/Kyber)
      ["0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", "0x6b175474e89094c44da98b954eedeac495271d0f"], // tokens to be in portfolio UNI, DAI
      [500, 500],  // Allocation of each token 500/1000 = 50%
      10, // Percentage imbalance until rebalance is allowed: 10/1000 = 1%
      995, // Slippage percent allowed during rebalance
      6000, // Restructure timelock
      { value: ethers.BigNumber.from('10000000000000000')}
    )
    let receipt = await tx.wait()

    // Get portfolio address from NewPortfolio event
    const portfolioAddress = receipt.events.find(ev => ev.event === 'NewPortfolio').args.portfolio
    portfolio = Portfolio.attach(portfolioAddress)

    // transfer portfolio tokens representing underlying assets
    await portfolio.transfer(accounts[2].address, amount)

```

# 7. Kovan Deployment
Or- [1. Asset Management Solidity V1](#1-asset-management-solidity-v1)
- [1. Asset Management Solidity V1](#1-asset-management-solidity-v1)
- [2. Getting started](#2-getting-started)
  - [2.1. Install](#21-install)
  - [2.2. Compile](#22-compile)
  - [2.3. Test](#23-test)
  - [2.4. Documentation](#24-documentation)
  - [2.5. Deploy](#25-deploy)
- [3. Contract Overview](#3-contract-overview)
  - [3.1. PortfolioProxyFactory](#31-portfolioproxyfactory)
  - [3.2. Portfolio](#32-portfolio)
  - [3.3. Routers](#33-routers)
  - [3.4. Controllers](#34-controllers)
- [4. Concepts](#4-concepts)
  - [4.1. Imbalance](#41-imbalance)
- [5. Roadmap](#5-roadmap)
- [6. Examples](#6-examples)
- [7. Kovan Deployment](#7-kovan-deployment)


Oracle deployed to:  0x8427A14b4D6F63336bE75e1b3501626B9ef1d9C0

Whitelist deployed to:  0x9322B0Cb683583A60B2334f6085ddC65c76011D1

UniswapAdapter deployed to:  0x2E145331C8C9800135C70de6e8F67ebFcd27FD1E

PortfolioControllerDeployer deployed to:  0x34DAdAc3899fD65c847872B16915422F05308569

PortfolioController deployed to:  0xD454e59de72592dEbB28a3EC529cE068114164Db

LoopRouter deployed to:  0x9b01b889E652f2d9F12d10aD177912363dFE55cF

GenericRouter deployed to:  0x3F4c51e1180281B5b8c17c6Ec01Aa1DE1597655F

PortfolioProxyFactory deployed to: 0x6b7d480f1deD80571CF87a05711683c223880b46
