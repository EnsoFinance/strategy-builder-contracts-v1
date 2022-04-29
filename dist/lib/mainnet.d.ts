import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract } from 'ethers';
import { Platform } from './deploy';
export declare class LiveEnvironment {
    signer: SignerWithAddress;
    platform: Platform;
    adapters: LiveAdapters;
    routers: LiveRouters;
    estimators: Estimators;
    constructor(signer: SignerWithAddress, platform: Platform, adapters: LiveAdapters, routers: LiveRouters, estimators: Estimators);
}
export declare type LiveAdapters = {
    aaveV2: Contract;
    aaveV2Debt: Contract;
    balancer: Contract;
    compound: Contract;
    curve: Contract;
    curveLP: Contract;
    curveGauge: Contract;
    leverage: Contract;
    synthetix: Contract;
    metastrategy: Contract;
    uniswapV2: Contract;
    uniswapV3: Contract;
    yearnV2: Contract;
};
export declare enum AdapterTypes {
    AaveV2 = "aavev2",
    AaveV2Debt = "aavev2debt",
    Balancer = "balancer",
    Compound = "compound",
    Curve = "curve",
    CurveLP = "curvelp",
    CurveGauge = "curvegauge",
    Leverage = "leverage",
    MetaStrategy = "metastrategy",
    Synthetix = "synthetix",
    UniswapV2 = "uniswapv2",
    UniswapV3 = "uniswapv3",
    YEarnV2 = "yearnv2"
}
export declare enum RouterTypes {
    Multicall = "multicall",
    Loop = "loop",
    Full = "full",
    Batch = "batch"
}
export declare type LiveRouters = {
    multicall: Contract;
    loop: Contract;
    full: Contract;
    batch: Contract;
};
export declare type Estimators = {
    defaultEstimator: Contract;
    chainlink: Contract;
    strategy: Contract;
    emergency: Contract;
    aaveV2: Contract;
    aaveV2Debt: Contract;
    compound: Contract;
    curveLP: Contract;
    curveGauge: Contract;
    yearnV2: Contract;
};
export declare function liveEstimators(signer: SignerWithAddress): Estimators;
export declare function livePlatform(signer: SignerWithAddress): Platform;
export declare function liveAdapters(signer: SignerWithAddress): LiveAdapters;
export declare function liveRouters(signer: SignerWithAddress): LiveRouters;
export declare function getLiveContracts(signer: SignerWithAddress): LiveEnvironment;
