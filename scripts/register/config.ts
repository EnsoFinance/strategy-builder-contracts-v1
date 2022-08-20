// The number of pairs to get info on from TheGraph (Ordered by ETH liquidity)
export const NumberOfPairs = 3000;
// Maximum distance/weight added from bad liquidity (unless below minimum, then returns MaxDistanceAllowed)
export const LiquidityRange = [1, 100];
// Maximum weight range returned from Calculator.determineDistance()
export const MaxDistanceAllowed = 200;

// Amount of ETH we are happy with in a UniV3Pool
export const MaxEthLiquidity = 50000; // Amount of ETH to reach distance 0 .. anything under should result in increased distance
export const MinEthLiquidity = 50; // Anything under this amount is not included in v1-core (distance > MaxDistanceAllowed)
export const MinEthLiquidityException = 5 // For tokens that are already part of strategies
export const MinTimeWindow = 30; // 30 seconds
export const MaxTimeWindow = 900 // 15 minutes
