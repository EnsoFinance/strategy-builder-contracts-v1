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


    StrategyProxyFactory: 0x78b95d03F5B189ff2e1E8fdc4CbEF1D5deBF3d0d

    StrategyController:  0x66Ef3d5Ef1DC1d3b7a01230746F2D7752fDbdC5A

    EnsoOracle:  0x90D56e3aa787142873771A226a35355466Ba19D7

    UniswapOracle:  0xd8D2a1A904F1B93A91C8b879223e222acD169DD8

    ChainlinkOracle:  0x305AFC472CE91e5D710E44dD0f971aF8b101BBac

    Whitelist:  0xCCaE9103186930b8c15c6FDA7949A16d9CFde44e

    StrategyProxyFactoryAdmin: 0x6C1B315180466E6E5bbca21D19Bc7fa5ACB9bb09

    StrategyControllerAdmin:  0x59a3cFc0c81f15305Ef997711C21a8751cfeb00D

    LoopRouter:  0x75b28ccB420a4e23F3BC1DF93622822CB155E02D

    FullRouter:  0x7E625c35E761de500138DD6A15B6BC0101f34a2b

    GenericRouter:  0x321b3DC9C348EC90acebD1dA5B564166aa3aa70D

    BatchDepositRouter:  0xb41fa26C4D3282229Be0066e88175A0Aec6Cf116

    UniswapV2Adapter:  0x64A09Df7236F8adE2F853086031D010Daf31DCc3

    MetaStrategyAdapter:  0xa34Af66c004e91bF1BaccccF6b3F417255aF6772

    SynthetixAdapter:  0x208FdA8ed24d3983C4Dea4137F3824860c3a1613

    CurveAdapter:  0x0B2E73EE3aD006e6AD53CB204fEcba212b380669

    CurveLPAdapter:  0x200F00645d79e913b930Ac3C120E7D4a4D9Ab341

    CurveRewardsAdapter:  0x1f8A248e51b571c0147037B4E4cCe4bFF7DfbBd6

    AaveLendAdapter:  0x0E8Ea36f2E51fA10fec9a259082922394a60B3c9

    AaveBorrowAdapter:  0xBDae6090CAe894284ff796fd5A30114b9BaCF695

    YEarnV2Adapter:  0xbcc3D46C6783F96CbAA7008e2956f3f339eA2848

    TokenRegistry:  0x6e603591680F52502450e937f568DE51d73E41D8

    CurvePoolRegistry:  0x8a0006C1458b52D595bb9c5DD15c6917415398f0

    BasicEstimator:  0x2761109dE5e62C9250205b6b74B93017E2E191a4

    AaveEstimator:  0x5b693d6b4CBB865B9F0BCfa63e06beD69Cb9275d

    AaveDebtEstimator:  0x1e5f32882b88737A4fA9ABD7F9d5AF2B4beb40E3

    CompoundEstimator:  0xC5E689797D9AaA3D019578A96386c7bb431Ae0D1

    CurveEstimator:  0x40a65A54225981BE6f3df5b4316171EA33ABD44a

    CurveGaugeEstimator:  0x1117067ff26cA5F26672106Fe76FD7cbFCd61637

    EmergencyEstimator:  0x7d80B840604cAbe1b231A5a16612c994FB7973DA

    SynthEstimator:  0xa58f32F863cB92e77a5286084f4c6586EF267Ea6

    StrategyEstimator:  0x984EC2570aC2513c41a19D99D697d2F1f9CA3Ad3

    UniswapV2Estimator:  0x8d7234d7B0C074064920aa115420572043469435

    YEarnV2Estimator:  0xF8B4B737ef4724f5Bda10510754c9312c6653eCA


# Security Considerations

While maintaining a TWAP oracle is expensive the social Strategy contracts are open to sandwich attacks if relying on uniswap directly.



- Sandwich attack if naively grabbing latest price from uniswap on all deposits/withdraws/rebalances.

  Manager could utilize this to drain value from the strategy (social strategies)
