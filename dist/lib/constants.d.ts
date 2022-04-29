export declare const DIVISOR = 1000;
export declare const MAINNET_ADDRESSES: {
    WETH: string;
    SUSD: string;
    USDC: string;
    UNISWAP_V2_FACTORY: string;
    UNISWAP_V3_FACTORY: string;
    UNISWAP_V3_ROUTER: string;
    KYBER_FACTORY: string;
    KYBER_ROUTER: string;
    BALANCER_REGISTRY: string;
    BALANCER_FACTORY: string;
    AAVE_ADDRESS_PROVIDER: string;
    CURVE_ADDRESS_PROVIDER: string;
    SYNTHETIX_ADDRESS_PROVIDER: string;
    COMPOUND_COMPTROLLER: string;
};
export declare const FEE = 997;
export declare const UNI_V3_FEE = 3000;
export declare const ORACLE_TIME_WINDOW = 1;
export declare const DEFAULT_DEPOSIT_SLIPPAGE = 990;
export declare enum TIMELOCK_CATEGORY {
    RESTRUCTURE = 0,
    THRESHOLD = 1,
    REBALANCE_SLIPPAGE = 2,
    RESTRUCTURE_SLIPPAGE = 3,
    TIMELOCK = 4,
    PERFORMANCE = 5
}
export declare enum ITEM_CATEGORY {
    BASIC = 0,
    SYNTH = 1,
    DEBT = 2,
    RESERVE = 3
}
export declare enum ESTIMATOR_CATEGORY {
    DEFAULT_ORACLE = 0,
    CHAINLINK_ORACLE = 1,
    STRATEGY = 2,
    BLOCKED = 3,
    AAVE_V1 = 4,
    AAVE_V2 = 5,
    AAVE_V2_DEBT = 6,
    AAVE_V3 = 7,
    AAVE_V3_DEBT = 8,
    ALCHEMIX = 9,
    BALANCER_V1_LP = 10,
    BALANCER_V2_LP = 11,
    COMP = 12,
    COMPOUND = 13,
    CONVEX = 14,
    CRV = 15,
    CURVE_LP = 16,
    CURVE_GAUGE = 17,
    DOPEX = 18,
    ENSO = 19,
    ENSO_STAKED = 20,
    FLAT = 21,
    FRAX = 22,
    LIQUITY = 23,
    OLYMPUS = 24,
    RIBBON = 25,
    SUSHI_BAR = 26,
    SUSHI_FARM = 27,
    SUSHI_LP = 28,
    SUSHI_TWAP_ORACLE = 29,
    UNISWAP_V2_LP = 30,
    UNISWAP_V2_TWAP_ORACLE = 31,
    UNISWAP_V3_LP = 32,
    YEARN_V1 = 33,
    YEARN_V2 = 34
}
