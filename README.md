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
  - [3.1. StrategyProxyFactory](#31-strategyproxyfactory)
  - [3.2. Strategy](#32-strategy)
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

The asset management contracts allows users to create a rebalancing strategy of erc20 tokens, by depositing ETH, which is swapped for the requested erc20's using decentralized exchanges and on chain time-weighted oracles.

If the eth value of any asset in the strategy falls outside of a provided threshold range, the contract will allow rebalances, which will swap the over/under represented assets on a dex.

[Contract Documentation](https://app.gitbook.com/@ensofinance/s/enso-finance/architecture/contracts/)

## 3.1. [StrategyProxyFactory](https://app.gitbook.com/@ensofinance/s/enso-finance/architecture/contracts/strategyproxyfactory.sol)
- The strategy factory deploys a proxy for all new strategys. This contract is where protocol admin values can be set/updated.

## 3.2. [Strategy](https://app.gitbook.com/@ensofinance/s/enso-finance/architecture/contracts/strategy.sol)
  - Strategys take deposits of ETH and swap it atomically for a basket of tokens, which are stored and rebalanced within the strategy. Depositers are minted erc20 liquidity tokens redeemable for the underlying tokens of the strategy. Strategys can be private or public/social. If social, the creator of the strategy has the authority to issue a restructure, with a timelock set at the creation of the strategy, giving people time to withdraw from the strategy.

## 3.3. Routers
  - Interface to swap tokens on different dexes


## 3.4. Controllers
  - Using the routers, the controller implements a trading strategy provided by the strategy manager.


# 4. Concepts

## 4.1. Imbalance

The strategy checks for an imbalance in an asset by:
```javascript
const expectedValueOfToken = strategyValue * tokenPercentage
const estimatedValueOfToken = tokenPriceInWeth * tokenBalance
const rebalanceThreshold = expectedValueOfToken * rebalanceSlippagePercent
const imbalance = Math.abs( Math.abs(expectedValueOfToken - estimatedValueOfToken) - rebalanceThreshold)
```

# 5. Roadmap
- [x] Rebalance strategy through DEX router
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
- [ ] Alternative Strategys
  - [ ] Prediction market outcome tokens
  - [ ] NFTs
- [ ] Gas Tokens


# 6. Examples

`Create Strategy`

```javascript
    const { ethers } = require('hardhat')
    const { constants, getContractAt } = ether

    // Porfolio interface
    const Strategy = await getContractFactory('Strategy')
    const StrategyProxyFactory = await getContractFactory('StrategyProxyFactory')
    const strategyFactory = await getContractAt(StrategyProxyFactory.abi, "0xEF7B263C46343713848Db0233aCC06E5C475d85c")

    // Create new strategy
    let tx = await strategyFactory.createStrategy(
      'My Strategy',
      'Symbol',
      ["0x68f9FfF89A247a3578ABFc8d8B62584725D031d2"],  // Routers (Uni/Sushi/Kyber)
      ["0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", "0x6b175474e89094c44da98b954eedeac495271d0f"], // tokens to be in strategy UNI, DAI
      [500, 500],  // Allocation of each token 500/1000 = 50%
      10, // Percentage imbalance until rebalance is allowed: 10/1000 = 1%
      995, // Slippage percent allowed during rebalance
      6000, // Restructure timelock
      { value: ethers.BigNumber.from('10000000000000000')}
    )
    let receipt = await tx.wait()

    // Get strategy address from NewStrategy event
    const strategyAddress = receipt.events.find(ev => ev.event === 'NewStrategy').args.strategy
    strategy = Strategy.attach(strategyAddress)

    // transfer strategy tokens representing underlying assets
    await strategy.transfer(accounts[2].address, amount)

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
  - [3.1. StrategyProxyFactory](#31-strategyproxyfactory)
  - [3.2. Strategy](#32-strategy)
  - [3.3. Routers](#33-routers)
  - [3.4. Controllers](#34-controllers)
- [4. Concepts](#4-concepts)
  - [4.1. Imbalance](#41-imbalance)
- [5. Roadmap](#5-roadmap)
- [6. Examples](#6-examples)
- [7. Kovan Deployment](#7-kovan-deployment)


Oracle deployed to:  0x7f9c80381c0952FF728E3aE12e2FBa3dbee7B9DD

Whitelist deployed to:  0x97AfB1d76CDa54518Cb06338f1323188de847993

UniswapAdapter deployed to:  0x8B0D03bf10e8AC672FA624956772F38C9837E8C8

StrategyControllerDeployer deployed to:  0x6175F799614b6362A2370E47d1901e3C4622F04C

StrategyController deployed to:  0x19439964E40079c82eD7b2dB764c45c8baD05834

LoopRouter deployed to:  0xd5D9b512b7a71cc7b660D11d4c73c034b492E806

GenericRouter deployed to:  0x0c717F79Ce26DC3bd142Fef1bf220Cc7D1C42e48

StrategyProxyFactory deployed to: 0x8A80a0B247EE00A7033e131ebe6c4c10E920c8ad
