import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract } from 'ethers';
export declare const FEE_SIZE = 3;
export declare type Multicall = {
    target: string;
    callData: string;
};
export declare type Position = {
    token: string;
    percentage?: BigNumber;
    adapters?: string[];
    path?: string[];
    cache?: string;
};
export declare type ItemData = {
    category: BigNumber;
    cache: string;
};
export declare type TradeData = {
    adapters: string[];
    path: string[];
    cache: string;
};
export declare type Item = {
    item: string;
    data: ItemData;
};
export declare type StrategyItem = {
    item: string;
    percentage: BigNumber;
    data: TradeData;
};
export declare type StrategyState = {
    timelock: BigNumber;
    rebalanceSlippage: BigNumber;
    restructureSlippage: BigNumber;
    social: boolean;
    set: boolean;
};
export declare type InitialState = {
    timelock: BigNumber;
    rebalanceThreshold: BigNumber;
    rebalanceSlippage: BigNumber;
    restructureSlippage: BigNumber;
    performanceFee: BigNumber;
    social: boolean;
    set: boolean;
};
export declare function prepareStrategy(positions: Position[], defaultAdapter: string): StrategyItem[];
export declare function prepareRebalanceMulticall(strategy: Contract, router: Contract, adapter: Contract, oracle: Contract, weth: Contract): Promise<Multicall[]>;
export declare function prepareDepositMulticall(strategy: Contract, controller: Contract, router: Contract, adapter: Contract, weth: Contract, total: BigNumber, strategyItems: StrategyItem[]): Promise<Multicall[]>;
export declare function preparePermit(strategy: Contract, owner: SignerWithAddress, spender: SignerWithAddress, value: BigNumber, deadline: BigNumber): Promise<any>;
export declare function calculateAddress(strategyFactory: Contract, creator: string, name: string, symbol: string): Promise<any>;
export declare function getExpectedTokenValue(total: BigNumber, token: string, strategy: Contract): Promise<any>;
export declare function getRebalanceRange(expectedValue: BigNumber, controller: Contract, strategy: Contract): Promise<any>;
export declare function encodeStrategyItem(position: Position): StrategyItem;
export declare function encodeSwap(adapter: Contract, amountTokens: BigNumber, minTokens: BigNumber, tokenIn: string, tokenOut: string, accountFrom: string, accountTo: string): Multicall;
export declare function encodeDelegateSwap(router: Contract, adapter: string, amount: BigNumber, minTokens: BigNumber, tokenIn: string, tokenOut: string, accountFrom: string, accountTo: string): Multicall;
export declare function encodeSettleSwap(router: Contract, adapter: string, tokenIn: string, tokenOut: string, accountFrom: string, accountTo: string): Multicall;
export declare function encodeSettleTransfer(router: Contract, token: string, accountTo: string): Multicall;
export declare function encodeSettleTransferFrom(router: Contract, token: string, accountFrom: string, accountTo: string): Multicall;
export declare function encodeTransfer(token: Contract, to: string, amount: BigNumber): Multicall;
export declare function encodeTransferFrom(token: Contract, from: string, to: string, amount: BigNumber): Multicall;
export declare function encodeApprove(token: Contract, to: string, amount: BigNumber): Multicall;
export declare function encodePath(path: string[], fees: number[]): string;
