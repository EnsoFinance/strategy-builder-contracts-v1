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

    StrategyProxyFactory: 0xaF80BB1794B887de4a6816Ab0219692a21e8430e

    StrategyController: 0x077a70998D5086E6c6D53D9Fb7BCfd8F7fb73AC2

    EnsoOracle: 0x1c6E43f88FA817eDE65ce84E8B98639Ba7e07b08

    UniswapOracle: 0xD2112D5966d0446995B91701CD4F347f7a74BD1e

    ChainlinkOracle: 0xCE34c735F1Ea5a8E56d69d969f842bBE248ce217

    LoopRouter: 0x724172d2f01137C22BE01c2010b7Ebc3D78DbDA8

    FullRouter: 0x66349850B8AfC011c4Bc09A20876BaB836143871

    GenericRouter: 0xE0a9382c01d6EDfA0c933714b3626435EeF10811

    BatchDepositRouter: 0x05450f1469F2A8D0009842DDA3e54c6451F41936

    UniswapV2Adapter: 0x3731D53ef2B183206a670080c61DA81b09da0C5d

    MetaStrategyAdapter: 0x283E0942c1769d5b0cb678B70550E0C11b445AD0

    SynthetixAdapter: 0x6A386FABcbf8dC0A51Bd421c268DAe50200D202e

    CurveAdapter: 0x6B65B9Aa611AC5147b3B46A87fE5f7E4ee626DDD

    AaveLendAdapter: 0xA33c4C788331DD434E2793512076577E731F3C9D

    Whitelist: 0x8d54770361F08b19f8F2770e565ff3aE0A48bd18

    TokenRegistry: 0xa8f7eab32D503e9997bDEDF3163C318886EDf7C1

    CurvePoolRegistry: 0x99b1Fdb33642512C75f3a9818656Fd8ECf2252Ff

    StrategyControllerAdmin: 0x1e67AC986E2a970E6Df44Ca44B734F9c8f6054E7

    StrategyProxyFactoryAdmin: 0x7cbd72aD25f1434ef95B0A2D7B5161931A6383fE

    BasicEstimator: 0x94644bf6064909A7CCe445513356fC6828a23Da6

    AaveEstimator: 0x2e0F13C873C9749d7B8ebe92df845c4968100D4C

    AaveDebtEstimator: 0x2133BDBa7DEba1C452B829234baE61F3c35D9653

    CompoundEstimator: 0x95b93f9099Db98ccbA44CC3f912165a7AFc8396a

    CurveEstimator: 0x1c882b46cEa1fb8f0F8e247241B49D3a198695b0

    CurveGaugeEstimator: 0xEf6425f6cAe0D391849901aae38D0464e390a55c

    SynthEstimator: 0xeE99c4f253AacCea56097eEcBe240B4F4E47dEfd

    StrategyEstimator: 0xb21Eef5C9a5dfF98bC13Adc6BFB3ECbb3A0f6431

    UniswapV2Estimator: 0x8F69bF5A33d4Dd804da78b68a2cF2748f156079C

    YEarnV2Estimator: 0x16750de29905dbC86d7497ca2D47907B16CE2bFA


# Security Considerations

While maintaining a TWAP oracle is expensive the social Strategy contracts are open to sandwich attacks if relying on uniswap directly.



- Sandwich attack if naively grabbing latest price from uniswap on all deposits/withdraws/rebalances.

  Manager could utilize this to drain value from the strategy (social strategies)
