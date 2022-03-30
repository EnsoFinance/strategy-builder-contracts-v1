# V1-Core


Enso V1 core contracts allow users to create strategies for a set of assets within the Defi ecosystem.The contracts are made up of 5 core components:  Strategy, StrategyController, Routers, Adapters, and the Oracle

## Security

Enso offers a simple results-driven bounty program aligning incentives of hackers and tinkerers across the gradient to ensure rapid discovery and subsequent patches to vulnerabilities in this system.

This bounty program addresses discovery of bugs that would lead to economic exploits, loss of funds, and griefing attacks. 

All "griefing attack" bug submissions must go through Immunefi's bug submission process on [Enso's bug bounty page]().

The discoverer of an "economic exploit" or "loss of funds" bug will be rewarded with 10% of the token they steal through such a vector so long as they:

- Invoke the attack only once, and cease exploiting that vector immediately.

- Report the bug, with reference to the proof-of-concept transaction to security@enso.finance.

- Send the remaining 90% of the token stolen to the Enso Treasury ETH mainnnet address 0xEE0e85c384F7370FF3eb551E92A71A4AFc1B259F.

- Advise and collaborate with the Enso team in patching the bug.


## Installation
Github
```bash
git clone git@github.com:EnsoFinance/v1-core.git  
```

Truffle/Hardhat
```bash
yarn install @enso/contracts
```

Forge
```bash
forge install EnsoFinance/v1-core
```

Dapptools
```bash
dapp install EnsoFinance/v1-core
```

## Compile
```
yarn run build
```

## Test
```
yarn run test
```

## Docs

[Contract Documentation](https://github.com/EnsoFinance/enso-docs)

```
├── adapters
│   ├── BaseAdapter.sol
│   ├── borrow
│   │   ├── AaveBorrowAdapter.sol
│   │   └── Leverage2XAdapter.sol
│   ├── exchanges
│   │   ├── BalancerAdapter.sol
│   │   ├── CurveAdapter.sol
│   │   ├── SynthetixAdapter.sol
│   │   ├── UniswapV2Adapter.sol
│   │   └── UniswapV3Adapter.sol
│   ├── lending
│   │   ├── AaveLendAdapter.sol
│   │   └── CompoundAdapter.sol
│   ├── liquidity
│   │   ├── CurveLPAdapter.sol
│   │   └── UniswapV2LPAdapter.sol
│   ├── strategy
│   │   └── MetaStrategyAdapter.sol
│   └── vaults
│       ├── CurveRewardsAdapter.sol
│       └── YEarnV2Adapter.sol
├── libraries
│   ├── Math.sol
│   ├── SafeERC20.sol
│   ├── StrategyLibrary.sol
│   └── UniswapV2Library.sol
├── oracles
│   ├── EnsoOracle.sol
│   ├── estimators
│   │   ├── AaveDebtEstimator.sol
│   │   ├── AaveEstimator.sol
│   │   ├── BasicEstimator.sol
│   │   ├── CompoundEstimator.sol
│   │   ├── CurveEstimator.sol
│   │   ├── CurveGaugeEstimator.sol
│   │   ├── EmergencyEstimator.sol
│   │   ├── StrategyEstimator.sol
│   │   ├── UniswapV2Estimator.sol
│   │   └── YEarnV2Estimator.sol
│   ├── protocols
│   │   ├── ChainlinkOracle.sol
│   │   ├── ProtocolOracle.sol
│   │   └── UniswapV3Oracle.sol
│   └── registries
│       ├── ChainlinkRegistry.sol
│       ├── CurveDepositZapRegistry.sol
│       ├── TokenRegistry.sol
│       └── UniswapV3Registry.sol
├── routers
│   ├── BatchDepositRouter.sol
│   ├── FullRouter.sol
│   ├── GenericRouter.sol
│   ├── LoopRouter.sol
│   └── StrategyRouter.sol
├── PlatformProxyAdmin.sol
├── StrategyController.sol
├── StrategyControllerStorage.sol
├── StrategyProxyAdmin.sol
├── StrategyProxyFactory.sol
├── StrategyProxyFactoryStorage.sol
├── Strategy.sol
├── StrategyToken.sol
├── StrategyTokenStorage.sol
└── Whitelist.sol
```


