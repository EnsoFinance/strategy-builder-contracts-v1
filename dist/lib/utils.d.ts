import { BigNumber } from 'ethers';
export declare function increaseTime(seconds: number): Promise<any>;
export declare function encodePriceSqrt(reserve1: number, reserve0: number): BigNumber;
export declare function getMinTick(tickSpacing: number): number;
export declare function getMaxTick(tickSpacing: number): number;
export declare function getDeadline(secondsInFuture: number): Promise<BigNumber>;
