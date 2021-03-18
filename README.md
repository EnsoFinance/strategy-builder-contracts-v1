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

## [∞](#install) 1. Install
```
npm install
```

## [∞](#compile) 2. Compile
```
npm run build
```

## [∞](#test) 3. Test
```
npm run test
```

## [∞](#documentation) 4. Documentation
```
npm run docs
```

## [∞](#deploy) 5. Deploy
To deploy contracts, you must first setup the .env file. You can find a example at .env_example. Then run the following command:

```
npm run deploy <network>
```

For example, to deploy on Kovan network run `npm run deploy kovan`


# 3. Contract Overview

[Contract Documentation](https://app.gitbook.com/@ensofinance/s/enso-finance/architecture/contracts/)

The Enso Strategy contracts allow users to create rebalancing erc20 pools, for themselves or for others to join also. Accounts can deposit ETH, which is swapped for the requested erc20's using decentralized exchanges and on chain time-weighted oracles. Each strategy has a manager, who is authorized to rebalance, restructure, or configure the strategy.


If a strategy is created with the `social` flag, other accounts will be authorized to deposit and withdraw from the strategy. All changes made by the manager are time-locked to allow other accounts enough time to withdraw from the strategy if they do not like the new configuration.  


## [∞](#strategyproxyfactoryhttpsappgitbookcomensofinancesenso-financearchitecturecontractsstrategyproxyfactorysol) 3.1. [StrategyProxyFactory](https://app.gitbook.com/@ensofinance/s/enso-finance/architecture/contracts/strategyproxyfactory.sol)
- The strategy factory is where new Strategy contracts can be deployed. A proxy is deployed and initialized for the current Strategy implementation.

## [∞](#strategyhttpsappgitbookcomensofinancesenso-financearchitecturecontractsstrategysol) 3.2. [Strategy](https://app.gitbook.com/@ensofinance/s/enso-finance/architecture/contracts/strategy.sol)
  - Strategys take deposits of ETH and swap it atomically for a basket of tokens, which are stored and rebalanced within the strategy. Depositers are minted erc20 liquidity tokens redeemable for the underlying tokens of the strategy. Strategys can be private or public/social. If social, the creator of the strategy has the authority to issue a restructure, with a timelock set at the creation of the strategy, giving people time to withdraw from the strategy.

## [∞](#routershttpsensofinancegitbookioenso-financearchitectureprotocolrouters) 3.3. [Routers](https://ensofinance.gitbook.io/enso-finance/architecture/protocol/routers)
  - A Router is a contract that swaps erc20 tokens in different ways, while providing a single interface.


## [∞](#strategy-controllerhttpsensofinancegitbookioenso-financearchitectureprotocolcontrollers) 3.4. [Strategy Controller](https://ensofinance.gitbook.io/enso-finance/architecture/protocol/controllers)
  - The strategy controller is the main entry point to already deployed strategies.

## [∞](#35-adapters) 3.5 [Adapters](https://ensofinance.gitbook.io/enso-finance/architecture/protocol)
  - Adapters provide a common interface to different Dex's


# 4. Concepts

## [∞](#imbalance) [Imbalance](https://ensofinance.gitbook.io/enso-finance/architecture/protocol/controllers/rebalance)

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
  - [ ] Balancer
  - [ ] 1Inch
  - [ ] Aave
  - [ ] SushiSwap
- [x] TWP Oracle
- [x] Restructuring timelock
- [x] Generic Router: Provide Flash loans to rebalancers
- [x] Withdraw tokens into ETH
- [x] Generic Router: Provide optional Flash loans to depositers/withdrawls
- [ ] Yield Farming
- [ ] Alternative Strategies
  - [ ] Prediction market outcome tokens
  - [ ] NFTs
- [ ] Gas Tokens
- [ ] Cross-chain


# 6. Examples

`Create Strategy`

```javascript
    const { ethers } = require('hardhat')
    const { constants, getContractAt } = ether

    // Porfolio interface
    const Strategy = await getContractFactory('Strategy')
    const StrategyProxyFactory = await getContractFactory('StrategyProxyFactory')
    const strategyFactory = await getContractAt(StrategyProxyFactory.abi, "0xEF7B263C46343713848Db0233aCC06E5C475d85c")

    const data = ethers.utils.defaultAbiCoder.encode(['address[]', 'address[]'], [strategyTokens, strategyAdapters])

    // Create new strategy
    let tx = await strategyFactory.createStrategy(
      'My Strategy',
      'Symbol',

      ["0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", "0x6b175474e89094c44da98b954eedeac495271d0f"], // tokens to be in strategy UNI, DAI
      [500, 500],  // Allocation of each token 500/1000 = 50%
      true, // Is strategy open for others to join?
      0, // Performance fee
      10, // Threshold of relative value difference until rebalance is allowed: 10/1000 = 1%
      995, // Slippage percent allowed during rebalance
      6000, // Restructure timelock length
      ["0x68f9FfF89A247a3578ABFc8d8B62584725D031d2"],  // Routers (Loop, Flash, Generic)
      data
      { value: ethers.BigNumber.from('10000000000000000')}
    )
    let receipt = await tx.wait()

    // Get strategy address from NewStrategy event
    const strategyAddress = receipt.events.find(ev => ev.event === 'NewStrategy').args.strategy
    strategy = Strategy.attach(strategyAddress)

    // transfer strategy tokens representing underlying assets
    await strategy.transfer(accounts[2].address, amount)

```


# 8. Kovan Deployment

Oracle deployed to:  0x5fa520BEBC1948DeE7F5b18E54fba6eB7CD2CF4B

Whitelist deployed to:  0xB27E43ACe8A3Ce268f878DFEBA5c5d99CcD1c6Da

UniswapAdapter deployed to:  0x6f12d21dcCF3B42d7e53D1547148E6D88cE47221

StrategyControllerAdmin deployed to:  0x1F9DE752d8Ed5005a8DEB80bf7f7fF55Ed25aeb9

StrategyController deployed to:  0x332FFdD57D88e87Ac6E92163Fddf853067c2466a

LoopRouter deployed to:  0x807feFDe300eaE8Ce8C3D38A3F2D8B17Ef1B4639

GenericRouter deployed to:  0xc969a157fCeAFf8A874068E3e524E29A2E986De8

StrategyProxyFactoryAdmin deployed to: 0xf1adA14856F782f26FA041E078D3e28B2A453758

StrategyProxyFactory deployed to: 0x0148C5b2b25a91F354b9ca1DC46eb3a840740aFe

# Security Considerations

While maintaining a TWAP oracle is expensive the social Strategy contracts are open to sandwich attacks if relying on uniswap directly.



- Sandwich attack if naively grabbing latest price from uniswap on all deposits/withdraws/rebalances.

  Manager could utilize this to drain value from the strategy (social strategies)
