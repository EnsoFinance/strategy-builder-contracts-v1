import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract } from 'ethers';
export declare type Oracles = {
    ensoOracle: Contract;
    protocols: {
        uniswapOracle: Contract;
        chainlinkOracle: Contract;
    };
    registries: {
        tokenRegistry: Contract;
        curvePoolRegistry: Contract;
        uniswapV3Registry: Contract;
    };
};
export declare type Administration = {
    whitelist: Contract;
    controllerAdmin: Contract;
    factoryAdmin: Contract;
};
export declare class Platform {
    strategyFactory: Contract;
    controller: Contract;
    oracles: Oracles;
    administration: Administration;
    constructor(strategyFactory: Contract, controller: Contract, oracles: Oracles, administration: Administration);
    print(): void;
}
export declare function deployTokens(owner: SignerWithAddress, numTokens: number, value: BigNumber): Promise<Contract[]>;
export declare function deployBalancer(owner: SignerWithAddress, tokens: Contract[]): Promise<[Contract, Contract]>;
export declare function deployBalancerAdapter(owner: SignerWithAddress, balancerRegistry: Contract, weth: Contract): Promise<Contract>;
export declare function deployUniswapV2(owner: SignerWithAddress, tokens: Contract[]): Promise<Contract>;
export declare function deployUniswapV3(owner: SignerWithAddress, tokens: Contract[]): Promise<Contract[]>;
export declare function deployPlatform(owner: SignerWithAddress, uniswapFactory: Contract, weth: Contract, susd?: Contract, feePool?: string): Promise<Platform>;
export declare function deployUniswapV2Adapter(owner: SignerWithAddress, uniswapFactory: Contract, weth: Contract): Promise<Contract>;
export declare function deployUniswapV3Adapter(owner: SignerWithAddress, uniswapRegistry: Contract, uniswapFactory: Contract, weth: Contract): Promise<Contract>;
export declare function deployMetaStrategyAdapter(owner: SignerWithAddress, controller: Contract, router: Contract, weth: Contract): Promise<Contract>;
export declare function deployAaveLendAdapter(owner: SignerWithAddress, lendingPool: Contract, strategyController: Contract, weth: Contract): Promise<Contract>;
export declare function deployAaveBorrowAdapter(owner: SignerWithAddress, lendingPool: Contract, weth: Contract): Promise<Contract>;
export declare function deployCompoundAdapter(owner: SignerWithAddress, comptroller: Contract, weth: Contract): Promise<Contract>;
export declare function deployYEarnAdapter(owner: SignerWithAddress, weth: Contract): Promise<Contract>;
export declare function deployCurveAdapter(owner: SignerWithAddress, curvePoolRegistry: Contract, weth: Contract): Promise<Contract>;
export declare function deployCurveLPAdapter(owner: SignerWithAddress, curvePoolRegistry: Contract, weth: Contract): Promise<Contract>;
export declare function deployCurveRewardsAdapter(owner: SignerWithAddress, curvePoolRegistry: Contract, weth: Contract): Promise<Contract>;
export declare function deploySynthetixAdapter(owner: SignerWithAddress, resolver: Contract, weth: Contract): Promise<Contract>;
export declare function deployLoopRouter(owner: SignerWithAddress, controller: Contract): Promise<Contract>;
export declare function deployFullRouter(owner: SignerWithAddress, controller: Contract): Promise<Contract>;
export declare function deployBatchDepositRouter(owner: SignerWithAddress, controller: Contract): Promise<Contract>;
export declare function deployGenericRouter(owner: SignerWithAddress, controller: Contract): Promise<Contract>;
