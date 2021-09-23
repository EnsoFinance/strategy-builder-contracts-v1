import { BigNumber, Contract } from 'ethers';
export declare function prepareFlashLoan(strategy: Contract, arbitrager: Contract, sellAdapter: Contract, buyAdapter: Contract, loanAmount: BigNumber, loanToken: Contract, pairToken: Contract): Promise<import("./encode").Multicall[]>;
export declare function encodeArbitrageLoan(arbitrager: Contract, lender: string, amount: BigNumber, loanToken: string, pairToken: string, sellAdapter: string, buyAdapter: string): {
    target: string;
    callData: string;
    value: number;
};
