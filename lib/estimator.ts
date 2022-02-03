import hre from 'hardhat'
import { BigNumber, Contract, Signer } from 'ethers'
import { TradeData } from './encode'
import { MAINNET_ADDRESSES, DIVISOR } from './utils'

import ISynth from '../artifacts/contracts/interfaces/synthetix/ISynth.sol/ISynth.json'
import ISynthetix from '../artifacts/contracts/interfaces/synthetix/ISynthetix.sol/ISynthetix.json'
import IExchanger from '../artifacts/contracts/interfaces/synthetix/IExchanger.sol/IExchanger.json'
import ICurveRegistry from '../artifacts/contracts/interfaces/curve/ICurveRegistry.sol/ICurveRegistry.json'
import ICurveStableSwap from '../artifacts/contracts/interfaces/curve/ICurveStableSwap.sol/ICurveStableSwap.json'
import UniswapV2Router from '@uniswap/v2-periphery/build/UniswapV2Router01.json'
import UniswapV3Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'

const { AddressZero } = hre.ethers.constants
const { defaultAbiCoder } = hre.ethers.utils

const SYNTHETIX = '0xDC01020857afbaE65224CfCeDb265d1216064c59'
const SYNTHETIX_EXCHANGER = '0x3e343E89F4fF8057806F54F2208940B1Cd5C40ca'
const CURVE_REGISTRY = '0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5'
const UNISWAP_V2_ROUTER = '0xf164fC0Ec4E93095b804a4795bBe1e041497b92a'
const UNISWAP_V3_QUOTER = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'
const WETH = MAINNET_ADDRESSES.WETH
const SUSD = MAINNET_ADDRESSES.SUSD
const VIRTUAL_ITEM = '0xffffffffffffffffffffffffffffffffffffffff'

export class Estimator {
  signer: Signer

  oracle: Contract
  curveRegistry: Contract
  synthetix: Contract
  synthetixExchanger: Contract
  uniswapV2Router: Contract
  uniswapV3Quoter: Contract
  uniswapV3Registry: Contract

  aaveAdapterAddress: string
  aaveDebtAdapterAddress: string
  balancerAdapterAddress: string
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
    signer: Signer,
    oracle: Contract,
    uniswapV3Registry: Contract,
    curveAdapterAddress: string,
    synthetixAdapterAddress: string,
    uniswapV2AdapterAddress: string,
    uniswapV3AdapterAddress: string
  ) {
    this.signer = signer

    this.curveRegistry = new Contract(CURVE_REGISTRY, ICurveRegistry.abi, signer)
    this.synthetix = new Contract(SYNTHETIX, ISynthetix.abi, signer)
    this.synthetixExchanger = new Contract(SYNTHETIX_EXCHANGER, IExchanger.abi, signer)
    this.uniswapV2Router = new Contract(UNISWAP_V2_ROUTER, UniswapV2Router.abi, signer)
    this.uniswapV3Quoter = new Contract(UNISWAP_V3_QUOTER, UniswapV3Quoter.abi, signer)

    this.oracle = oracle
    this.uniswapV3Registry = uniswapV3Registry

    this.curveAdapterAddress = curveAdapterAddress
    this.synthetixAdapterAddress = synthetixAdapterAddress
    this.uniswapV2AdapterAddress = uniswapV2AdapterAddress
    this.uniswapV3AdapterAddress = uniswapV3AdapterAddress

    this.aaveAdapterAddress = AddressZero
    this.aaveDebtAdapterAddress = AddressZero
    this.balancerAdapterAddress = AddressZero
    this.compoundAdapterAddress = AddressZero

    this.curveLPAdapterAddress = AddressZero
    this.curveRewardsAdapterAddress = AddressZero
    this.uniswapV2LPAdapterAddress = AddressZero
    this.yearnV2AdapterAddress = AddressZero

  }

  async estimateBatchBuy(
      strategy: Contract,
      total: BigNumber,
      estimates: BigNumber[]
  ) {
      const [ items, synths, rebalanceThreshold ] = await Promise.all([
        strategy.items(),
        strategy.synths(),
        strategy.rebalanceThreshold()
      ])

      const amounts: BigNumber[] = await Promise.all(items.map(async (strategyItem: string, index: number) => {
          const [ percentage, tradeData ] = await Promise.all([
            strategy.getPercentage(strategyItem),
            strategy.getTradeData(strategyItem)
          ])
          const expectedValue = percentage.eq('0') ? BigNumber.from('0') : total.mul(percentage).div(DIVISOR)
          const rebalanceRange = rebalanceThreshold.eq('0') ? BigNumber.from('0') : expectedValue.mul(rebalanceThreshold).div(DIVISOR);
          const amount = await this.estimateBuyItem(
              strategyItem,
              estimates[index],
              expectedValue,
              rebalanceRange,
              tradeData
          );
          return this.oracle.estimateItem(amount, strategyItem);
      }))
      if (synths.length > 0) {
          // Purchase SUSD
          const [ percentage, tradeData ] = await Promise.all([
            strategy.getPercentage(VIRTUAL_ITEM),
            strategy.getTradeData(SUSD)
          ])
          const expectedValue = percentage.eq('0') ?  BigNumber.from('0') : total.mul(percentage).div(DIVISOR)
          const rebalanceRange = rebalanceThreshold.eq('0') ? BigNumber.from('0') : expectedValue.mul(rebalanceThreshold).div(DIVISOR);
          const susdAmount = await this.estimateBuyItem(
              SUSD,
              estimates[estimates.length - 1],
              expectedValue,
              rebalanceRange,
              tradeData
          );
          amounts.push(await this.estimateBuySynths(strategy, synths, percentage, susdAmount));
      }
      const percentage = await strategy.getPercentage(WETH);
      if (percentage.gt('0')) {
        amounts.push(total.mul(percentage).div(DIVISOR));
      }
      const valueAdded = amounts.reduce((a: BigNumber, b: BigNumber) => a.add(b));
      return valueAdded
  }

  async estimateBuySynths(strategy: Contract, synths: string[], synthPercentage: BigNumber, susdAmount: BigNumber) {
    let totalValue = BigNumber.from('0')
    let susdRemaining = susdAmount
    for (let i = 0; i < synths.length; i++) {
      const [ percentage, tradeData ] = await Promise.all([
        strategy.getPercentage(synths[i]),
        strategy.getTradeData(synths[i])
      ])
      if (!percentage.eq('0')) {
        const amount = susdAmount.mul(percentage).div(synthPercentage);
        if (amount.gt('0')) {
          const balance = await this.estimateSwap(
            tradeData.adapters[0],
            amount,
            SUSD,
            synths[i]
          )
          const value = await this.oracle.estimateItem(balance, synths[i])
          totalValue = totalValue.add(value)
          susdRemaining = susdRemaining.sub(amount)
        }
      }
    }
    if (susdRemaining.gt('0')) {
      const value = await this.oracle.estimateItem(susdRemaining, SUSD)
      totalValue = totalValue.add(value)
    }
    return totalValue
  }

  async estimateBuyItem(
      token: string,
      estimatedValue: BigNumber,
      expectedValue: BigNumber,
      rebalanceRange: BigNumber,
      tradeData: TradeData
  ) {
      let amount = BigNumber.from('0');
      if (estimatedValue.eq('0')) {
          amount = expectedValue;
      } else if (estimatedValue.gt(expectedValue.sub(rebalanceRange))) {
          amount = expectedValue.sub(estimatedValue);
      }
      if (amount.gt('0')) {
          if (tradeData.cache != '0x') {
              //Apply multiplier
              const multiplier = defaultAbiCoder.decode(['uint16'], tradeData.cache)[0];
              amount = amount.mul(multiplier).div(DIVISOR);
          }
          return this.estimateBuyPath(
              tradeData,
              amount,
              token
          );
      }
      return BigNumber.from('0');
  }

  async estimateBuyPath(
    tradeData: TradeData,
    amount: BigNumber,
    token: string
  ) {
    if (amount.gt('0')) {
        let balance = amount;
        for (let i = 0; i < tradeData.adapters.length; i++) {
            let _tokenIn;
            let _tokenOut;
            if (i == 0) {
                _tokenIn = WETH;
            } else {
                _tokenIn = tradeData.path[i-1];
            }
            if (i == tradeData.adapters.length-1) {
                _tokenOut = token;
            } else {
                _tokenOut = tradeData.path[i];
            }
            balance = await this.estimateSwap(
              tradeData.adapters[i],
              balance,
              _tokenIn,
              _tokenOut
            )
        }
        return balance;
    }
    return BigNumber.from('0');
  }

  async estimateSwap(
    adapter: string,
    amount: BigNumber,
    tokenIn: string,
    tokenOut: string
  ) {
    switch (adapter.toLowerCase()) {
      case this.aaveAdapterAddress.toLowerCase():
        return BigNumber.from('0')//this.estimateAave(amount, tokenIn, tokenOut)
      case this.aaveDebtAdapterAddress.toLowerCase():
        return BigNumber.from('0')//this.estimateAaveDebt(amount, tokenIn, tokenOut)
      case this.balancerAdapterAddress.toLowerCase():
        return BigNumber.from('0')//this.estimateBalancer(amount, tokenIn, tokenOut)
      case this.compoundAdapterAddress.toLowerCase():
        return BigNumber.from('0')//this.estimateCompound(amount, tokenIn, tokenOut)
      case this.curveAdapterAddress.toLowerCase():
        return this.estimateCurve(amount, tokenIn, tokenOut)
      case this.curveLPAdapterAddress.toLowerCase():
        return BigNumber.from('0')//this.estimateCurveLP(amount, tokenIn, tokenOut)
      case this.curveRewardsAdapterAddress.toLowerCase():
        return BigNumber.from('0')//this.estimateCurveGauge(amount, tokenIn, tokenOut)
      case this.synthetixAdapterAddress.toLowerCase():
        return this.estimateSynthetix(amount, tokenIn, tokenOut)
      case this.uniswapV2AdapterAddress.toLowerCase():
        return this.estimateUniswapV2(amount, tokenIn, tokenOut)
      case this.uniswapV3AdapterAddress.toLowerCase():
        return this.estimateUniswapV3(amount, tokenIn, tokenOut)
      case this.yearnV2AdapterAddress.toLowerCase():
        return BigNumber.from('0')//this.estimateYearnV2(amount, tokenIn, tokenOut)
      default:
        return BigNumber.from('0');
    }
  }

  async estimateCurve(amount: BigNumber, tokenIn: string, tokenOut: string) {
      const pool = await this.curveRegistry.find_pool_for_coins(tokenIn, tokenOut, 0);
      if (pool != AddressZero) {
          const [ indexIn, indexOut, ] = await this.curveRegistry.get_coin_indices(pool, tokenIn, tokenOut);
          return (new Contract(pool, ICurveStableSwap.abi, this.signer)).get_dy(indexIn, indexOut, amount);
      } else {
        return BigNumber.from('0');
      }
  }

  async estimateSynthetix(amount: BigNumber, tokenIn: string, tokenOut: string) {
    const [ targetIn, targetOut ] = await Promise.all([
      (new Contract(tokenIn, ISynth.abi, this.signer)).target(),
      (new Contract(tokenOut, ISynth.abi, this.signer)).target()
    ])
    const [ tokenInKey, tokenOutKey ] = await Promise.all([
      this.synthetix.synthsByAddress(targetIn),
      this.synthetix.synthsByAddress(targetOut)
    ])
    const [ amountReceived, , ] = await this.synthetixExchanger.getAmountsForExchange(amount, tokenInKey, tokenOutKey)
    return amountReceived
  }

  async estimateUniswapV2(amount: BigNumber, tokenIn: string, tokenOut: string) {
    return (await this.uniswapV2Router.getAmountsOut(amount, [tokenIn, tokenOut]))[1]
  }

  async estimateUniswapV3(amount: BigNumber, tokenIn: string, tokenOut: string) {
    const fee = await this.uniswapV3Registry.getFee(tokenIn, tokenOut)
    return (await this.uniswapV3Quoter.quoteExactInputSingle({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: amount,
      fee: fee,
      sqrtPriceLimitX96: 0
    })).amount
  }
}
