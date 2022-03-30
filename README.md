# V1-Core


Enso V1 core contracts allow users to create strategies for a set of assets within the Defi ecosystem.The contracts are made up of 5 core components:  Strategy, StrategyController, Routers, Adapters, and the Oracle

## Security

See the [Enso security repo](https://github.com/EnsoFinance/enso-security)

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


