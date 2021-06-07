import { BigNumber } from 'ethers';
export declare const FEE = 997;
export declare const DIVISOR = 1000;
export declare const UNI_V3_FEE = 3000;
export declare const MAINNET_ADDRESSES: {
    WETH: string;
    UNISWAP: string;
    BALANCER_REGISTRY: string;
    BALANCER_FACTORY: string;
};
export declare function increaseTime(seconds: number): any;
export declare const TIMELOCK_CATEGORY: {
    RESTRUCTURE: number;
    THRESHOLD: number;
    SLIPPAGE: number;
    TIMELOCK: number;
};
export declare function encodePriceSqrt(reserve1: number, reserve0: number): BigNumber;
export declare function getMinTick(tickSpacing: number): number;
export declare function getMaxTick(tickSpacing: number): number;
export declare function getDeadline(secondsInFuture: number): Promise<BigNumber>;
