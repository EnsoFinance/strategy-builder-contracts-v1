import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract } from 'ethers';
export declare function deployTokens(owner: SignerWithAddress, numTokens: number, value: BigNumber): Promise<Contract[]>;
export declare function deployBalancer(owner: SignerWithAddress, tokens: Contract[]): Promise<[Contract, Contract]>;
export declare function deployBalancerAdapter(owner: SignerWithAddress, balancerRegistry: Contract, weth: Contract): Promise<any>;
export declare function deployUniswapV2(owner: SignerWithAddress, tokens: Contract[]): Promise<Contract>;
export declare function deployUniswapV3(owner: SignerWithAddress, tokens: Contract[]): Promise<any[]>;
export declare function deployUniswapV2Adapter(owner: SignerWithAddress, uniswapFactory: Contract, weth: Contract): Promise<Contract>;
export declare class Platform {
    strategyFactory: Contract;
    controller: Contract;
    oracle: Contract;
    whitelist: Contract;
    controllerAdmin: Contract;
    constructor(strategyFactory: Contract, controller: Contract, oracle: Contract, whitelist: Contract, controllerAdmin: Contract);
    print(): void;
}
export declare function deployPlatform(owner: SignerWithAddress, uniswapFactory: Contract, weth: Contract): Promise<Platform>;
export declare function deployLoopRouter(owner: SignerWithAddress, controller: Contract, adapter: Contract, weth: Contract): Promise<any>;
export declare function deployGenericRouter(owner: SignerWithAddress, controller: Contract, weth: Contract): Promise<any>;
