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
        curveDepositZapRegistry: Contract;
        uniswapV3Registry: Contract;
        chainlinkRegistry: Contract;
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
    library: Contract;
    constructor(strategyFactory: Contract, controller: Contract, oracles: Oracles, administration: Administration, library: Contract);
    print(): void;
}
export declare function deployTokens(owner: SignerWithAddress, numTokens: number, value: BigNumber): Promise<Contract[]>;
export declare function deployBalancer(owner: SignerWithAddress, tokens: Contract[]): Promise<[Contract, Contract]>;
export declare function deployBalancerAdapter(owner: SignerWithAddress, balancerRegistry: Contract, weth: Contract): Promise<Contract>;
export declare function deployUniswapV2(owner: SignerWithAddress, tokens: Contract[]): Promise<Contract>;
export declare function deployUniswapV3(owner: SignerWithAddress, tokens: Contract[]): Promise<Contract[]>;
export declare function deployPlatform(owner: SignerWithAddress, uniswapFactory: Contract, weth: Contract, susd?: Contract, feePool?: string): Promise<Platform>;
export declare function deployUniswapV2Adapter(owner: SignerWithAddress, uniswapFactory: Contract, weth: Contract): Promise<Contract>;
export declare function deployUniswapV2LPAdapter(owner: SignerWithAddress, uniswapFactory: Contract, weth: Contract): Promise<Contract>;
export declare function deployUniswapV3Adapter(owner: SignerWithAddress, uniswapRegistry: Contract, uniswapFactory: Contract, weth: Contract): Promise<Contract>;
export declare function deployMetaStrategyAdapter(owner: SignerWithAddress, controller: Contract, router: Contract, weth: Contract): Promise<Contract>;
export declare function deployAaveLendAdapter(owner: SignerWithAddress, addressProvider: Contract, strategyController: Contract, weth: Contract): Promise<Contract>;
export declare function deployAaveBorrowAdapter(owner: SignerWithAddress, addressProvider: Contract, weth: Contract): Promise<Contract>;
export declare function deployCompoundAdapter(owner: SignerWithAddress, comptroller: Contract, weth: Contract): Promise<Contract>;
export declare function deployYEarnAdapter(owner: SignerWithAddress, weth: Contract): Promise<Contract>;
export declare function deployCurveAdapter(owner: SignerWithAddress, curveAddressProvider: Contract, weth: Contract): Promise<Contract>;
export declare function deployCurveLPAdapter(owner: SignerWithAddress, curveAddressProvider: Contract, curveDepositZapRegistry: Contract, weth: Contract): Promise<Contract>;
export declare function deployCurveRewardsAdapter(owner: SignerWithAddress, curveAddressProvider: Contract, weth: Contract): Promise<Contract>;
export declare function deploySynthetixAdapter(owner: SignerWithAddress, resolver: Contract, weth: Contract): Promise<Contract>;
export declare function deployLeverage2XAdapter(owner: SignerWithAddress, defaultAdapter: Contract, aaveLendAdapter: Contract, aaveBorrowAdapter: Contract, debtToken: Contract, weth: Contract): Promise<Contract>;
export declare function deployLoopRouter(owner: SignerWithAddress, controller: Contract, library: Contract): Promise<Contract>;
export declare function deployFullRouter(owner: SignerWithAddress, addressProvider: Contract, controller: Contract, library: Contract): Promise<Contract>;
export declare function deployBatchDepositRouter(owner: SignerWithAddress, controller: Contract, library: Contract): Promise<Contract>;
export declare function deployGenericRouter(owner: SignerWithAddress, controller: Contract): Promise<Contract>;
