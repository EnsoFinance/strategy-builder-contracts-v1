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
    platformProxyAdmin: Contract;
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
export declare function deployPlatform(owner: SignerWithAddress, uniswapOracleFactory: Contract, uniswapV3Factory: Contract, weth: Contract, susd?: Contract, feePool?: string): Promise<Platform>;
export declare function deployEnsoToken(owner: SignerWithAddress, minter: SignerWithAddress, name: string, symbol: string, mintingAllowedAfter: number): Promise<Contract>;
export declare function deployEnsoEstimator(owner: SignerWithAddress, sEnso: Contract, defaultEstimator: Contract, strategyFactory: Contract): Promise<Contract>;
export declare function deployStakedEnsoEstimator(owner: SignerWithAddress, strategyFactory: Contract): Promise<Contract>;
export declare function deployUniswapV2Adapter(owner: SignerWithAddress, uniswapV2Factory: Contract, weth: Contract): Promise<Contract>;
export declare function deployEnsoStakingAdapter(owner: SignerWithAddress, staking: Contract, stakingToken: Contract, distributionToken: Contract, weth: Contract): Promise<Contract>;
export declare function deployUniswapV2LPAdapter(owner: SignerWithAddress, uniswapV2Factory: Contract, weth: Contract): Promise<Contract>;
export declare function deployUniswapV3Adapter(owner: SignerWithAddress, uniswapRegistry: Contract, uniswapRouter: Contract, weth: Contract): Promise<Contract>;
export declare function deployMetaStrategyAdapter(owner: SignerWithAddress, controller: Contract, router: Contract, weth: Contract): Promise<Contract>;
export declare function deployAaveV2Adapter(owner: SignerWithAddress, addressProvider: Contract, strategyController: Contract, weth: Contract): Promise<Contract>;
export declare function deployAaveV2DebtAdapter(owner: SignerWithAddress, addressProvider: Contract, weth: Contract): Promise<Contract>;
export declare function deployCompoundAdapter(owner: SignerWithAddress, comptroller: Contract, weth: Contract): Promise<Contract>;
export declare function deployYEarnAdapter(owner: SignerWithAddress, weth: Contract): Promise<Contract>;
export declare function deployCurveAdapter(owner: SignerWithAddress, curveAddressProvider: Contract, weth: Contract): Promise<Contract>;
export declare function deployCurveLPAdapter(owner: SignerWithAddress, curveAddressProvider: Contract, curveDepositZapRegistry: Contract, weth: Contract): Promise<Contract>;
export declare function deployCurveGaugeAdapter(owner: SignerWithAddress, curveAddressProvider: Contract, weth: Contract): Promise<Contract>;
export declare function deploySynthetixAdapter(owner: SignerWithAddress, resolver: Contract, weth: Contract): Promise<Contract>;
export declare function deployLeverage2XAdapter(owner: SignerWithAddress, defaultAdapter: Contract, aaveV2Adapter: Contract, aaveV2DebtAdapter: Contract, debtToken: Contract, weth: Contract): Promise<Contract>;
export declare function deployLoopRouter(owner: SignerWithAddress, controller: Contract, library: Contract): Promise<Contract>;
export declare function deployFullRouter(owner: SignerWithAddress, addressProvider: Contract, controller: Contract, library: Contract): Promise<Contract>;
export declare function deployBatchDepositRouter(owner: SignerWithAddress, controller: Contract, library: Contract): Promise<Contract>;
export declare function deployMulticallRouter(owner: SignerWithAddress, controller: Contract): Promise<Contract>;
