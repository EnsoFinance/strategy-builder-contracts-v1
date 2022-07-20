export const DIVISOR = 1000
export const MAINNET_ADDRESSES = {
	WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
	SUSD: '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
	USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
	UNISWAP_V2_FACTORY: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
	UNISWAP_V3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
	UNISWAP_V3_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
	KYBER_FACTORY: '0x833e4083B7ae46CeA85695c4f7ed25CDAd8886dE',
	KYBER_ROUTER: '0x1c87257f5e8609940bc751a07bb085bb7f8cdbe6',
	SUSHI_FACTORY: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
	BALANCER_REGISTRY: '0x65e67cbc342712DF67494ACEfc06fe951EE93982',
	BALANCER_FACTORY: '0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd',
	AAVE_ADDRESS_PROVIDER: '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
	CURVE_ADDRESS_PROVIDER: '0x0000000022D53366457F9d5E68Ec105046FC4383',
	SYNTHETIX_ADDRESS_PROVIDER: '0x823bE81bbF96BEc0e25CA13170F5AaCb5B79ba83',
	COMPOUND_COMPTROLLER: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B'
}
export const VIRTUAL_ITEM = '0xffffffffffffffffffffffffffffffffffffffff'

export const FEE = 997
export const UNI_V3_FEE = 3000
export const ORACLE_TIME_WINDOW = 1
export const DEFAULT_DEPOSIT_SLIPPAGE = 990

export enum TIMELOCK_CATEGORY {
	RESTRUCTURE,
	REBALANCE_THRESHOLD,
	REBALANCE_SLIPPAGE,
	RESTRUCTURE_SLIPPAGE,
	TIMELOCK,
	PERFORMANCE_FEE,
	MANAGEMENT_FEE
}

export enum ITEM_CATEGORY {
	BASIC,
	SYNTH,
	DEBT,
	RESERVE
}

export enum ESTIMATOR_CATEGORY {
	DEFAULT_ORACLE,//Set in contracts
	CHAINLINK_ORACLE,//Set in contracts
	STRATEGY,//Set in contracts
	BLOCKED,//Set in contracts
	AAVE_V1,
	AAVE_V2,
	AAVE_V2_DEBT,
	AAVE_V3,
	AAVE_V3_DEBT,
	ALCHEMIX,
	BALANCER_V1_LP,
	BALANCER_V2_LP,
	COMP,
	COMPOUND,
	CONVEX,
	CRV,
	CURVE_LP,
	CURVE_GAUGE,
	DOPEX,
	ENSO,
	ENSO_STAKED,
	FLAT,
	FRAX,
	LIQUITY,
	OLYMPUS,
	RIBBON,
	SUSHI_BAR,
	SUSHI_FARM,
	SUSHI_LP,
	SUSHI_TWAP_ORACLE,
	UNISWAP_V2_LP,
	UNISWAP_V2_TWAP_ORACLE,
	UNISWAP_V3_LP,
	YEARN_V1,
	YEARN_V2
}
