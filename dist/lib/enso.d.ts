import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract } from 'ethers';
import { Platform } from './deploy';
export declare const wethPerToken: (numTokens: number) => BigNumber;
export declare type EnsoAdapters = {
    aavelend: Adapter;
    aaveborrow: Adapter;
    balancer: Adapter;
    compound: Adapter;
    curve: Adapter;
    curveLP: Adapter;
    curveRewards: Adapter;
    leverage: Adapter;
    synthetix: Adapter;
    metastrategy: Adapter;
    uniswap: Adapter;
    uniswapV2: Adapter;
    uniswapV3: Adapter;
    yearnV2: Adapter;
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
    uniswapV2Factory: Contract;
    tokens: Contract[];
    balancer?: Balancer;
    constructor(signer: SignerWithAddress, defaults: Defaults, platform: Platform, adapters: EnsoAdapters, routers: Router[], uniswapV2Factory: Contract, tokens: Contract[], balancer?: Balancer);
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
    AaveLend = "aavelend",
    AaveBorrow = "aaveborrow",
    Balancer = "balancer",
    Compound = "compound",
    Curve = "curve",
    CurveLP = "curvelp",
    CurveRewards = "curverewards",
    Leverage = "leverage",
    MetaStrategy = "metastrategy",
    Synthetix = "synthetix",
    Uniswap = "uniswap",
    UniswapV2 = "uniswapv2",
    UniswapV3 = "uniswapv3",
    YEarnV2 = "yearnv2"
}
export declare class Adapter {
    type: Adapters;
    contract?: Contract;
    constructor(adapterType: string);
    deploy(signer: SignerWithAddress, whitelist: Contract, parameters: Contract[]): Promise<void>;
}
export declare enum Routers {
    Generic = 0,
    Loop = 1,
    Full = 2,
    Batch = 3
}
export declare class Router {
    type: Routers;
    contract?: Contract;
    constructor(routerType: string);
    deploy(signer: SignerWithAddress, controller: Contract, library: Contract): Promise<void>;
}
