import { BigNumber } from 'ethers';
export declare const FEE = 997;
export declare const DIVISOR = 1000;
export declare const UNI_V3_FEE = 3000;
export declare const ORACLE_TIME_WINDOW = 1;
export declare const MAINNET_ADDRESSES: {
    WETH: string;
    UNISWAP: string;
    BALANCER_REGISTRY: string;
    BALANCER_FACTORY: string;
};
export declare enum TIMELOCK_CATEGORY {
    RESTRUCTURE = 0,
    THRESHOLD = 1,
    SLIPPAGE = 2,
    TIMELOCK = 3,
    PERFORMANCE = 4
}
export declare enum ITEM_CATEGORY {
    BASIC = 0,
    SYNTH = 1,
    DEBT = 2,
    RESERVE = 3
}
export declare enum ESTIMATOR_CATEGORY {
    BASIC = 0,
    STRATEGY = 1,
    SYNTH = 2,
    COMPOUND = 3,
    AAVE = 4,
    AAVE_DEBT = 5,
    YEARN_V1 = 6,
    YEARN_V2 = 7,
    CURVE = 8,
    CURVE_GAUGE = 9,
    BALANCER = 10,
    UNISWAP_V2 = 11,
    UNISWAP_V3 = 12,
    SUSHI = 13,
    SUSHI_FARM = 14
}
export declare function increaseTime(seconds: number): Promise<any>;
export declare function encodePriceSqrt(reserve1: number, reserve0: number): BigNumber;
export declare function getMinTick(tickSpacing: number): number;
export declare function getMaxTick(tickSpacing: number): number;
export declare function getDeadline(secondsInFuture: number): Promise<BigNumber>;
