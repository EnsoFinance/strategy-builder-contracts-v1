import { BigNumber, Contract, Signer } from 'ethers';
import { StrategyItem, TradeData } from './encode';
interface ItemDictionary {
    [id: string]: StrategyItem;
}
export declare class Estimator {
    signer: Signer;
    oracle: Contract;
    tokenRegistry: Contract;
    curveRegistry: Contract;
    synthetix: Contract;
    synthetixExchanger: Contract;
    uniswapV2Router: Contract;
    uniswapV3Quoter: Contract;
    uniswapV3Registry: Contract;
    aaveV2AdapterAddress: string;
    aaveDebtAdapterAddress: string;
    balancerAdapterAddress: string;
    compoundAdapterAddress: string;
    curveAdapterAddress: string;
    curveLPAdapterAddress: string;
    curveRewardsAdapterAddress: string;
    synthetixAdapterAddress: string;
    uniswapV2AdapterAddress: string;
    uniswapV2LPAdapterAddress: string;
    uniswapV3AdapterAddress: string;
    yearnV2AdapterAddress: string;
    constructor(signer: Signer, oracle: Contract, tokenRegistry: Contract, uniswapV3Registry: Contract, aaveV2AdapterAddress: string, compoundAdapterAddress: string, curveAdapterAddress: string, curveLPAdapterAddress: string, curveRewardsAdapterAddress: string, synthetixAdapterAddress: string, uniswapV2AdapterAddress: string, uniswapV3AdapterAddress: string, yearnV2AdapterAddress: string);
    create(strategyItems: StrategyItem[], rebalanceThreshold: BigNumber, amount: BigNumber): Promise<BigNumber>;
    deposit(strategy: Contract, amount: BigNumber): Promise<BigNumber>;
    withdraw(strategy: Contract, amount: BigNumber): Promise<BigNumber>;
    estimateBatchBuy(items: string[], synths: string[], itemsData: ItemDictionary, rebalanceThreshold: BigNumber, total: BigNumber, estimates: BigNumber[]): Promise<BigNumber>;
    estimateBuySynths(itemsData: ItemDictionary, synths: string[], synthPercentage: BigNumber, susdAmount: BigNumber): Promise<BigNumber>;
    estimateBuyItem(token: string, estimatedValue: BigNumber, expectedValue: BigNumber, rebalanceRange: BigNumber, data: TradeData): Promise<BigNumber>;
    estimateBuyPath(data: TradeData, amount: BigNumber, token: string): Promise<BigNumber>;
    estimateSellPath(data: TradeData, amount: BigNumber, token: string): Promise<BigNumber>;
    estimateSwap(adapter: string, amount: BigNumber, tokenIn: string, tokenOut: string): Promise<any>;
    estimateAaveV2(amount: BigNumber, tokenIn: string, tokenOut: string): Promise<BigNumber>;
    estimateCompound(amount: BigNumber, tokenIn: string, tokenOut: string): Promise<BigNumber>;
    estimateCurve(amount: BigNumber, tokenIn: string, tokenOut: string): Promise<any>;
    estimateCurveLP(amount: BigNumber, tokenIn: string, tokenOut: string): Promise<any>;
    estimateCurveGauge(amount: BigNumber, tokenIn: string, tokenOut: string): Promise<BigNumber>;
    estimateSynthetix(amount: BigNumber, tokenIn: string, tokenOut: string): Promise<any>;
    estimateUniswapV2(amount: BigNumber, tokenIn: string, tokenOut: string): Promise<any>;
    estimateUniswapV3(amount: BigNumber, tokenIn: string, tokenOut: string): Promise<any>;
    estimateYearnV2(amount: BigNumber, tokenIn: string, tokenOut: string): Promise<any>;
    getPathPrice(data: TradeData, amount: BigNumber, token: string): Promise<BigNumber>;
    getStrategyItem(strategy: Contract, item: string): Promise<{
        item: string;
        percentage: any;
        data: any;
    }>;
}
export {};
