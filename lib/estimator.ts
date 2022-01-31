import { BigNumber, Contract } from 'ethers'

import ISynth from '../artifacts/contracts/interfaces/synthetix/ISynth.sol/ISynth.json'
import ISynthetix from '../artifacts/contracts/interfaces/synthetix/ISynthetix.sol/ISynthetix.json'
import IExchanger from '../artifacts/contracts/interfaces/synthetix/IExchanger.sol/IExchager.json'
import UniswapV2Router from '@uniswap/v2-periphery/build/UniswapV2Router.json'
import UniswapV3Quoter from '@uniswap/v3-periphery/build/UniswapV3Quoter.json'

const SYNTHETIX = ''
const SYNTHETIX_EXCHANGER = ''
const UNISWAP_V2_ROUTER = ''
const UNISWAP_V3_QUOTER = ''
const VIRTUAL_ITEM = '0xffffffffffffffffffffffffffffffffffffffff'

export class Estimator {
  uniswapV2Router: Contract
  uniswapV3Quoter: Contract
  uniswapV3Registry: Contract

  aaveAdapterAddress: string
  aaveDebtAdapterAddress: string
  compoundAdapterAddress: string
  curveAdapterAddress: string
  curveLPAdapterAddress: string
  curveRewardsAdapterAddress: string
  synthetixAdapterAddress: string
  uniswapV2AdapterAddress: string
  uniswapV2LPAdapterAddress: string
  uniswapV3AdapterAddress: string
  yearnV2AdapterAddress: string


  public constructor(
    uniswapV3Registry: Contract,
    synthetixAdapterAddress: string,
    uniswapV2AdapterAddress: string,
    uniswapV3AdapterAddress: string
  ) {
    this.synthetix = new Contract(SYNTHETIX, ISynthetix.abi)
    this.synthetixExchanger = new Contract(SYNTHETIX_EXCHANGER, IExchager.abi)
    this.uniswapV2Router = new Contract(UNISWAP_V2_ROUTER, UniswapV2Router.abi)
    this.uniswapV3Quoter = new Contract(UNISWAP_V3_QUOTER, UniswapV3Quoter.abi)

    this.uniswapV3Registry = uniswapV3Registry
    this.synthetixAdapterAddress = synthetixAdapterAddress
    this.uniswapV2AdapterAddress = uniswapV2AdapterAddress
    this.uniswapV3AdapterAddress = uniswapV3AdapterAddress
  }

  async estimateBatchBuy(
      strategyAddress: string,
      total: BigNumber,
      estimates: BigNumber[]
  ) {
      const strategy = new Contract(strategyAddress, Strategy.abi)
      const [ items, debt, synths, rebalanceThreshold ] = await Promise.all([
        strategy.items(),
        strategy.synths(),
        strategy.rebalanceThreshold()
      ])

      const amounts = await Promise.all(items.map(async (strategyItem: string) => {
          const [ percentage, tradeData ] = await Promise.all([
            strategy.getPercentage(strategyItem),
            strategy.getTradeData(strategyItem)
          ])
          const expectedValue = percentage.eq('0') ? BigNumber.from('0') : total.mul(percentage).div(DIVISOR)
          const rebalanceRange = rebalanceThreshold.eq('0') ? BigNumber.from('0') : expectedValue.mul(rebalanceThreshold).div(DIVISOR);
          return estimateItem(
              strategyItem,
              estimates[i],
              expectedValue,
              rebalanceRange,
              tradeData
          );
      }))
      if (synths.length > 0) {
          // Purchase SUSD
          const [ percentage, tradeData ] = await Promise.all([
            strategy.getPercentage(VIRTUAL_ITEM),
            strategy.getTradeData(SUSD)
          ])
          const expectedValue = percentage.eq('0') ? total.mul(percentage).div(DIVISOR) : BigNumber.from('0')
          const rebalanceRange = rebalanceThreshold.eq('0') ? BigNumber.from('0') : expectedValue.mul(rebalanceThreshold).div(DIVISOR);
          const susdAmount = estimateAmount(
              SUSD,
              estimates[estimates.length - 1],
              expectedValue,
              rebalanceRange,
              tradeData
          );
          amounts.push(estimateBuySynths(strategy, total));
      }
      const percentage = await strategy.getPercentage(weth);
      if (percentage.gt('0') && from.toLowerCase() != strategy.toLowerCase()) {
        amounts.push(total.mul(percentage).div(DIVISOR));
      }
      return amounts.reduce((a, b) => a.add(b));
  }

  async estimateBuySynths(strategy: Contract, total: BigNumber) {
      // Use SUSD to purchase other synths
      const susdWethPrice = controller.oracle().estimateItem(10**18, SUSD);
      for (uint256 i = 0; i < synths.length; i++) {
          const [ percentage, tradeData ] = await Promise.all([
            strategy.getPercentage(strategyItem),
            strategy.getTradeData(strategyItem)
          ])
          const amount = percentage.eq('0')
              ? BigNumber.from('0')
              : total.mul(percentage).div(DIVISOR).mul(10**18).div(susdWethPrice);
          if (amount.gt('0')) {
            const balance = estimateSwap(
              IStrategy(strategy).getTradeData(synths[i]).adapters[0],
              amount,
              susd,
              synths[i]
            )
          }
      }
  }

  async estimateBuyItem(
      token: string,
      estimatedValue: BigNumber,
      expectedValue: BigNumber,
      rebalanceRange: BigNumber,
      tradeData: TradeData
  ) {
      let amount;
      if (estimatedValue.eq('0')) {
          amount = expectedValue;
      } else if (estimatedValue.gt(expectedValue.sub(rebalanceRange))) {
          amount = expectedValue.sub(estimatedValue);
      }
      if (amount.gt('0')) {
          if (tradeData.cache.length > 0) {
              //Apply multiplier
              const multiplier = abi.decode(tradeData.cache, (uint16));
              amount = amount.mul(multiplier).div(DIVISOR);
          }
          return estimateBuyPath(
              tradeData,
              amount,
              token
          );
      }
      return 0;
  }

  async estimateBuyPath(
    tradeData: TradeData,
    amount: BigNumber,
    token: string
  ) {
    if (amount > 0) {
        let balance;
        for (uint256 i = 0; i < data.adapters.length; i++) {
            let _amount;
            let _tokenIn;
            let _tokenOut;
            if (i == 0) {
                _tokenIn = weth;
                _amount = amount;
            } else {
                _tokenIn = data.path[i-1];
                _amount = balance;
            }
            if (i == data.adapters.length-1) {
                _tokenOut = token;
            } else {
                _tokenOut = data.path[i];
            }
            balance = await estimateSwap(
              data.adapters[i],
              _amount,
              _tokenIn,
              _tokenOut
            )
        }
        return oracle.estimateItem(balance, token);
    }
    return 0;
  }

  async estimateSwap(
    adapter: string,
    amount: BigNumber,
    tokenIn: string,
    tokenOut: string
  ) {
    switch (adapter.toLowerCase()) {
      case this.aaveAdapterAddress:
        return estimateAave(amount, tokenIn, tokenOut)
      case this.aaveDebtAdapterAddress:
        return estimateAaveDebt(amount, tokenIn, tokenOut)
      case this.balanceAdapterAddress:
        return estimateBalancer(amount, tokenIn, tokenOut)
      case this.compoundAdapterAddress:
        return estimateCompound(amount, tokenIn, tokenOut)
      case this.curveAdapterAddress:
        return estimateCurve(amount, tokenIn, tokenOut)
      case this.curveLPAdapterAddress:
        return estimateCurveLP(amount, tokenIn, tokenOut)
      case this.curveRewardsAdapterAddress:
        return estimateCurveGauge(amount, tokenIn, tokenOut)
      case this.synthetixAdapterAddress:
        return estimateSynthetix(amount, tokenIn, tokenOut)
      case this.uniswapV2AdapterAddress:
        return estimateUniswapV2(amount, tokenIn, tokenOut)
      case this.uniswapV3AdapterAddress:
        return estimateUniswapV3(amount, tokenIn, tokenOut)
      case this.yearnV2AdapterAddress:
        return estimateYearnV2(amount, tokenIn, tokenOut)
      default:
        return 0;
    }
  }

  async estimateSynthetix(amount: BigNumber, tokenIn: string, tokenOut: string) {
    const [ targetIn, targetOut ] = await Promise.all([
      (new Contract(tokenIn, ISynth.abi)).target(),
      (new Contract(tokenOut, ISynth.abi)).target()
    ])
    const [ tokenInKey, tokenOutKey ] = await Promise.all([
      synthetix.synthsByAddress(targetIn),
      synthetix.synthsByAddress(targetOut)
    ])
    const [ amountReceived, , ] = await synthetixExchanger.getAmountsForExchange(amount, tokenInKey, tokenOutKey)
    return amountReceived
  }

  async estimateUniswapV2(amount: BigNumber, tokenIn: string, tokenOut: string) {
    return (await uniswapV2Router.getAmountsOut(amount, [tokenIn, tokenOut]))[1]
  }

  async estimateUniswapV3(amount: BigNumber, tokenIn: string, tokenOut: string) {
    const fee = await uniswapV3Registry.getFee(tokenIn, tokenOut)
    return (await uniswapV3Quoter.quoteExactInputSingle({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: amount,
      fee: fee,
      sqrtPriceLimitX96: 0
    })).amount
  }
}
