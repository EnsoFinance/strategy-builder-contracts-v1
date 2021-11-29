import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract } from 'ethers';
import { Platform } from './deploy';
export declare const wethPerToken: (numTokens: number) => BigNumber;
export declare type EnsoAdapters = {
    aavelend: Adapter;
    aaveborrow: Adapter;
    balancer: Adapter;
    curve: Adapter;
    leverage: Adapter;
    synthetix: Adapter;
    metastrategy: Adapter;
    uniswap: Adapter;
};
export declare class EnsoBuilder {
    signer: SignerWithAddress;
    defaults: Defaults;
    tokens?: Contract[];
    network?: Networks;
    routers?: Router[];
    adapters?: EnsoAdapters;
    constructor(signer: SignerWithAddress);
    mainnet(): this;
    testnet(): this;
    setDefaults(defaults: Defaults): void;
    addRouter(type: string): this;
    addAdapter(type: string): this;
    private deployBalancer;
    build(): Promise<EnsoEnvironment>;
}
export declare class EnsoEnvironment {
    signer: SignerWithAddress;
    defaults: Defaults;
    platform: Platform;
    adapters: EnsoAdapters;
    routers: Router[];
    uniswap: Contract;
    tokens: Contract[];
    balancer?: Balancer;
    constructor(signer: SignerWithAddress, defaults: Defaults, platform: Platform, adapters: EnsoAdapters, routers: Router[], uniswap: Contract, tokens: Contract[], balancer?: Balancer);
}
export declare class Balancer {
    factory: Contract;
    registry: Contract;
    constructor(factory: Contract, registry: Contract);
}
export declare enum Networks {
    Mainnet = "Mainnet",
    LocalTestnet = "LocalTestnet",
    ExternalTestnet = "ExternalTestnet"
}
export declare type Defaults = {
    threshold: number;
    slippage: number;
    timelock: number;
    numTokens: number;
    wethSupply: BigNumber;
};
export declare enum Adapters {
    Balancer = "balancer",
    Curve = "curve",
    MetaStrategy = "metastrategy",
    Synthetix = "synthetix",
    Uniswap = "uniswap",
    AaveLend = "aavelend",
    AaveBorrow = "aaveborrow",
    Leverage = "leverage"
}
export declare class Adapter {
    type: Adapters;
    contract?: Contract;
    constructor(adapterType: string);
    deploy(signer: SignerWithAddress, platform: Platform, adapterTargetFactory: Contract, weth: Contract, adapters?: EnsoAdapters): Promise<void>;
}
export declare enum Routers {
    Generic = 0,
    Loop = 1,
    Full = 2
}
export declare class Router {
    type: Routers;
    contract?: Contract;
    constructor(routerType: string);
    deploy(signer: SignerWithAddress, controller: Contract): Promise<void>;
}
