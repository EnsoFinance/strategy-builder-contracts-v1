import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'
import { ITEM_CATEGORY, ESTIMATOR_CATEGORY } from "./utils"

export class Tokens {
  // Basic
	weth: string
	wbtc: string
	dai: string
  usdc: string
  usdt: string
  usdp: string
	tusd: string
	link: string
	crv: string
	knc: string
	// Synth
	sUSD: string
	sEUR: string
	sLINK: string
	sETH: string
	sBTC: string
	sAAVE: string
	sDOT: string
	sADA: string
	// Aave
	aWETH: string
	aWBTC: string
	aDAI: string
	aUSDC: string
	aUSDT: string
	// Compound
	cDAI: string
	cUSDC: string
  // Curve
  crv3: string
  crvUSDP: string
	crvSUSD: string
	crvAAVE: string
	crvSAAVE: string
	crvLINK: string
	crvCOMP: string
	crvY: string
	// Curve Gauge
  crv3Gauge: string
  crvUSDPGauge: string
	crvSUSDGauge: string
	crvAAVEGauge: string
	crvSAAVEGauge: string
	crvLINKGauge: string
	crvCOMPGauge: string
	crvYGauge: string
  // YEarn
	ycrv3: string
  ycrvUSDP: string
  yDAI: string
	yUSDC: string
	ycrvSUSD: string
	// Debt
	debtDAI: string
	debtUSDC: string
	debtWBTC: string

	public constructor() {
    // Basic Tokens
		this.weth = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
		this.wbtc = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
    this.dai = '0x6b175474e89094c44da98b954eedeac495271d0f'
    this.usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    this.usdt = '0xdac17f958d2ee523a2206206994597c13d831ec7'
    this.usdp = '0x1456688345527bE1f37E9e627DA0837D6f08C925'
		this.tusd = '0x0000000000085d4780B73119b644AE5ecd22b376'
		this.link = '0x514910771AF9Ca656af840dff83E8264EcF986CA'
		this.crv = '0xd533a949740bb3306d119cc777fa900ba034cd52'
		this.knc = '0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202'
		// Synthetix
		this.sUSD = '0x57ab1ec28d129707052df4df418d58a2d46d5f51'
		this.sEUR = '0xd71ecff9342a5ced620049e616c5035f1db98620'
		this.sETH = '0x5e74c9036fb86bd7ecdcb084a0673efc32ea31cb'
    this.sBTC = '0xfe18be6b3bd88a2d2a7f928d00292e7a9963cfc6'
		this.sAAVE = '0xd2df355c19471c8bd7d8a3aa27ff4e26a21b4076'
		this.sLINK = '0xbBC455cb4F1B9e4bFC4B73970d360c8f032EfEE6'
    this.sDOT = '0x1715ac0743102bf5cd58efbb6cf2dc2685d967b6'
    this.sADA = '0xe36e2d3c7c34281fa3bc737950a68571736880a1'
		// Aave Tokens
		this.aWETH = '0x030bA81f1c18d280636F32af80b9AAd02Cf0854e'
		this.aWBTC = '0x9ff58f4fFB29fA2266Ab25e75e2A8b3503311656'
		this.aDAI = '0x028171bCA77440897B824Ca71D1c56caC55b68A3'
		this.aUSDC = '0xBcca60bB61934080951369a648Fb03DF4F96263C'
		this.aUSDT = '0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811'
    // Aave Debt Tokens
		this.debtDAI = '0x778A13D3eeb110A4f7bb6529F99c000119a08E92'
		this.debtUSDC = '0xE4922afAB0BbaDd8ab2a88E0C79d884Ad337fcA6'
		this.debtWBTC = '0x51B039b9AFE64B78758f8Ef091211b5387eA717c'
		// Compound Tokens
		this.cDAI = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643'
		this.cUSDC = '0x39aa39c021dfbae8fac545936693ac917d5e7563'
    // Curve LP Tokens
    this.crv3 = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490'
    this.crvUSDP = '0x7Eb40E450b9655f4B3cC4259BCC731c63ff55ae6'
		this.crvSUSD = '0xC25a3A3b969415c80451098fa907EC722572917F'
		this.crvAAVE = '0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900'
		this.crvSAAVE = '0x02d341CcB60fAaf662bC0554d13778015d1b285C'
		this.crvLINK = '0xcee60cfa923170e4f8204ae08b4fa6a3f5656f3a'
		this.crvCOMP = '0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2'
		this.crvY = '0xdF5e0e81Dff6FAF3A7e52BA697820c5e32D806A8'
		// Curve Gauge Tokens
		this.crv3Gauge = '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A'
		this.crvUSDPGauge = '0x055be5DDB7A925BfEF3417FC157f53CA77cA7222'
		this.crvSUSDGauge = '0xA90996896660DEcC6E997655E065b23788857849'
		this.crvAAVEGauge = '0xd662908ADA2Ea1916B3318327A97eB18aD588b5d'
		this.crvSAAVEGauge = '0x462253b8F74B72304c145DB0e4Eebd326B22ca39'
		this.crvLINKGauge = '0xFD4D8a17df4C27c1dD245d153ccf4499e806C87D'
		this.crvCOMPGauge = '0x7ca5b0a2910B33e9759DC7dDB0413949071D7575'
		this.crvYGauge = '0xFA712EE4788C042e2B7BB55E6cb8ec569C4530c1'
    // YEarn Tokens
		this.ycrv3 = '0x84E13785B5a27879921D6F685f041421C7F482dA'
    this.ycrvUSDP = '0xC4dAf3b5e2A9e93861c3FBDd25f1e943B8D87417'
		this.ycrvSUSD = '0x5a770DbD3Ee6bAF2802D29a901Ef11501C44797A'
    this.yDAI = '0x19D3364A399d251E894aC732651be8B0E4e85001'
		this.yUSDC = '0xd6aD7a6750A7593E092a9B218d66C0A814a3436e'
  }

  async registerTokens(owner: SignerWithAddress, strategyFactory: Contract, curvePoolRegistry?: Contract, chainlinkOracle?: Contract) {
    await Promise.all([
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.RESERVE, ESTIMATOR_CATEGORY.BASIC, this.weth),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.RESERVE, ESTIMATOR_CATEGORY.SYNTH, this.sUSD),
			strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.SYNTH, this.knc),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, this.sEUR),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, this.sLINK),
			strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, this.sETH),
			strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, this.sAAVE),
			strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, this.sBTC),
			strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, this.sDOT),
			strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, this.sADA),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE, this.aWETH),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE, this.aWBTC),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE, this.aDAI),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE, this.aUSDC),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE, this.aUSDT),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.DEBT, ESTIMATOR_CATEGORY.AAVE_DEBT, this.debtDAI),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.DEBT, ESTIMATOR_CATEGORY.AAVE_DEBT, this.debtUSDC),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.DEBT, ESTIMATOR_CATEGORY.AAVE_DEBT, this.debtWBTC),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.COMPOUND, this.cDAI),
			strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.COMPOUND, this.cUSDC),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, this.crv3),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, this.crvUSDP),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, this.crvSUSD),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, this.crvAAVE),
			strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, this.crvSAAVE),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, this.crvLINK),
			strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, this.crvCOMP),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crv3Gauge),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvUSDPGauge),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvSUSDGauge),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvAAVEGauge),
			strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvSAAVEGauge),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvLINKGauge),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2, this.ycrv3),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2, this.ycrvUSDP),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2, this.ycrvSUSD),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2, this.yDAI),
			strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.BLOCKED, '0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E') //TUSD second address
    ])
		if (curvePoolRegistry) {
			await curvePoolRegistry.connect(owner).addPool(this.crv3, '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', this.crv3Gauge, false);
			await curvePoolRegistry.connect(owner).addPool(this.crvSUSD, '0xfcba3e75865d2d561be8d220616520c171f12851', '0xA5407eAE9Ba41422680e2e00537571bcC53efBfD', this.crvSUSDGauge, true);
			await curvePoolRegistry.connect(owner).addPool(this.crvAAVE, '0xDeBF20617708857ebe4F679508E7b7863a8A8EeE', '0xDeBF20617708857ebe4F679508E7b7863a8A8EeE', this.crvAAVEGauge, false);
			await curvePoolRegistry.connect(owner).addPool(this.crvSAAVE, '0xEB16Ae0052ed37f479f7fe63849198Df1765a733', '0xEB16Ae0052ed37f479f7fe63849198Df1765a733', this.crvSAAVEGauge, false)
			await curvePoolRegistry.connect(owner).addPool(this.crvLINK, '0xf178c0b5bb7e7abf4e12a4838c7b7c5ba2c623c0', '0xf178c0b5bb7e7abf4e12a4838c7b7c5ba2c623c0', this.crvLINKGauge, false);
			await curvePoolRegistry.connect(owner).addPool(this.crvUSDP, '0x3c8cAee4E09296800f8D29A68Fa3837e2dae4940', '0x42d7025938bEc20B69cBae5A77421082407f053A', this.crvUSDPGauge, false);
			await curvePoolRegistry.connect(owner).addPool(this.crvCOMP, '0xeb21209ae4c2c9ff2a86aca31e123764a3b6bc06', '0xA2B47E3D5c44877cca798226B7B8118F9BFb7A56', this.crvCOMPGauge, true);
		}
		if (chainlinkOracle) {
			await chainlinkOracle.connect(owner).addOracle(this.sUSD, this.weth, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', true);
			await chainlinkOracle.connect(owner).addOracle(this.sEUR, this.sUSD, '0xb49f677943BC038e9857d61E7d053CaA2C1734C1', false);
			await chainlinkOracle.connect(owner).addOracle(this.sLINK, this.weth, '0xDC530D9457755926550b59e8ECcdaE7624181557', false);
			await chainlinkOracle.connect(owner).addOracle(this.knc, this.sUSD, '0xf8ff43e991a81e6ec886a3d281a2c6cc19ae70fc', false);
			await chainlinkOracle.connect(owner).addOracle(this.sETH, this.sUSD, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', false);
			await chainlinkOracle.connect(owner).addOracle(this.sAAVE, this.weth, '0x6df09e975c830ecae5bd4ed9d90f3a95a4f88012', false);
			await chainlinkOracle.connect(owner).addOracle(this.sBTC, this.weth, '0xdeb288f737066589598e9214e782fa5a8ed689e8', false);
			await chainlinkOracle.connect(owner).addOracle(this.sDOT, this.sUSD, '0x1c07afb8e2b827c5a4739c6d59ae3a5035f28734', false);
			await chainlinkOracle.connect(owner).addOracle(this.sADA, this.sUSD, '0xae48c91df1fe419994ffda27da09d5ac69c30f55', false);
		}
  }
}
