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
	link: string
	crv: string
	// Synth
	susd: string
	seur: string
	slink: string
	// Aave
	aWETH: string
	aWBTC: string
	aDAI: string
	aUSDC: string
	aUSDT: string
	// Compound
	cDAI: string
  // Curve
  crv3: string
  crvUSDP: string
	crvSUSD: string
	crvAAVE: string
	crvLINK: string
	// Curve Gauge
  crv3Gauge: string
  crvUSDPGauge: string
	crvSUSDGauge: string
	crvAAVEGauge: string
	crvLINKGauge: string
  // YEarn
	ycrv3: string
  ycrvUSDP: string
  yDAI: string
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
		this.link = '0x514910771AF9Ca656af840dff83E8264EcF986CA'
		this.crv = '0xd533a949740bb3306d119cc777fa900ba034cd52'
		// Synthetix
		this.susd = '0x57ab1ec28d129707052df4df418d58a2d46d5f51'
		this.seur = '0xd71ecff9342a5ced620049e616c5035f1db98620'
		this.slink = '0xbBC455cb4F1B9e4bFC4B73970d360c8f032EfEE6'
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
    // Curve LP Tokens
    this.crv3 = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490'
    this.crvUSDP = '0x7Eb40E450b9655f4B3cC4259BCC731c63ff55ae6'
		this.crvSUSD = '0xC25a3A3b969415c80451098fa907EC722572917F'
		this.crvAAVE = '0xFd2a8fA60Abd58Efe3EeE34dd494cD491dC14900'
		this.crvLINK = '0xcee60cfa923170e4f8204ae08b4fa6a3f5656f3a'
		// Curve Gauge Tokens
		this.crv3Gauge = '0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A'
		this.crvUSDPGauge = '0x055be5DDB7A925BfEF3417FC157f53CA77cA7222'
		this.crvSUSDGauge = '0xA90996896660DEcC6E997655E065b23788857849'
		this.crvAAVEGauge = '0xd662908ADA2Ea1916B3318327A97eB18aD588b5d'
		this.crvLINKGauge = '0xFD4D8a17df4C27c1dD245d153ccf4499e806C87D'
    // YEarn Tokens
		this.ycrv3 = '0x84E13785B5a27879921D6F685f041421C7F482dA'
    this.ycrvUSDP = '0xC4dAf3b5e2A9e93861c3FBDd25f1e943B8D87417'
		this.ycrvSUSD = '0x5a770DbD3Ee6bAF2802D29a901Ef11501C44797A'
    this.yDAI = '0x19D3364A399d251E894aC732651be8B0E4e85001'


  }

  async registerTokens(owner: SignerWithAddress, strategyFactory: Contract) {
    await Promise.all([
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.RESERVE, ESTIMATOR_CATEGORY.BASIC, this.weth),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.RESERVE, ESTIMATOR_CATEGORY.SYNTH, this.susd),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, this.seur),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.SYNTH, ESTIMATOR_CATEGORY.SYNTH, this.slink),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE, this.aWETH),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE, this.aWBTC),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE, this.aDAI),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE, this.aUSDC),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.AAVE, this.aUSDT),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.DEBT, ESTIMATOR_CATEGORY.AAVE_DEBT, this.debtDAI),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.DEBT, ESTIMATOR_CATEGORY.AAVE_DEBT, this.debtUSDC),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.DEBT, ESTIMATOR_CATEGORY.AAVE_DEBT, this.debtWBTC),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.COMPOUND, this.cDAI),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, this.crv3),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, this.crvUSDP),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, this.crvSUSD),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, this.crvAAVE),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE, this.crvLINK),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crv3Gauge),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvUSDPGauge),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvSUSDGauge),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvAAVEGauge),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.CURVE_GAUGE, this.crvLINKGauge),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2, this.ycrv3),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2, this.ycrvUSDP),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2, this.ycrvSUSD),
      strategyFactory.connect(owner).addItemToRegistry(ITEM_CATEGORY.BASIC, ESTIMATOR_CATEGORY.YEARN_V2, this.yDAI)
    ])
  }
}
