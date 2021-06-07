import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract } from 'ethers';
export declare const FEE_SIZE = 3;
export declare type Multicall = {
    target: string;
    callData: string;
    value: BigNumber;
};
export declare type Position = {
    token: string;
    percentage: BigNumber;
};
export declare class StrategyBuilder {
    tokens: string[];
    percentages: BigNumber[];
    adapters: string[];
    constructor(positions: Position[], adapter: string);
}
export declare function prepareUniswapSwap(router: Contract, adapter: Contract, factory: Contract, from: string, to: string, amount: BigNumber, tokenIn: Contract, tokenOut: Contract): Promise<Multicall[]>;
export declare function prepareRebalanceMulticall(strategy: Contract, controller: Contract, router: Contract, adapter: Contract, oracle: Contract, weth: Contract): Promise<Multicall[]>;
export declare function prepareDepositMulticall(strategy: Contract, controller: Contract, router: Contract, adapter: Contract, weth: Contract, total: BigNumber, tokens: string[], percentages: BigNumber[]): Promise<Multicall[]>;
export declare function preparePermit(strategy: Contract, owner: SignerWithAddress, spender: SignerWithAddress, value: BigNumber, deadline: BigNumber): Promise<any>;
export declare function calculateAddress(strategyFactory: Contract, creator: string, name: string, symbol: string, tokens: string[], percentages: BigNumber[]): Promise<any>;
export declare function getExpectedTokenValue(total: BigNumber, token: string, strategy: Contract): Promise<any>;
export declare function getRebalanceRange(expectedValue: BigNumber, controller: Contract, strategy: Contract): Promise<any>;
export declare function encodeSwap(adapter: Contract, amountTokens: BigNumber, minTokens: BigNumber, tokenIn: string, tokenOut: string, accountFrom: string, accountTo: string): Multicall;
export declare function encodeDelegateSwap(router: Contract, adapter: string, amount: BigNumber, minTokens: BigNumber, tokenIn: string, tokenOut: string, accountFrom: string, accountTo: string): Multicall;
export declare function encodeUniswapPairSwap(pair: Contract, amount0Out: BigNumber, amount1Out: BigNumber, accountTo: string): Multicall;
export declare function encodeSettleSwap(router: Contract, adapter: string, tokenIn: string, tokenOut: string, accountFrom: string, accountTo: string): Multicall;
export declare function encodeSettleTransfer(router: Contract, token: string, accountTo: string): Multicall;
export declare function encodeSettleTransferFrom(router: Contract, token: string, accountFrom: string, accountTo: string): Multicall;
export declare function encodeTransfer(token: Contract, to: string, amount: BigNumber): Multicall;
export declare function encodeTransferFrom(token: Contract, from: string, to: string, amount: BigNumber): Multicall;
export declare function encodeApprove(token: Contract, to: string, amount: BigNumber): Multicall;
export declare function encodeWethDeposit(weth: Contract, amount: BigNumber): Multicall;
export declare function encodeEthTransfer(to: string, amount: BigNumber): Multicall;
export declare function encodePath(path: string[], fees: number[]): string;
