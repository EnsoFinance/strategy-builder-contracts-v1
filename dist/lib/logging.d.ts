import { Contract } from '@ethersproject/contracts';
export declare function displayBalances(wrapper: Contract, tokens: string[], weth: Contract): Promise<void>;
export declare function colorLog(message: string, defaultColor: string): void;
