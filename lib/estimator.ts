import { BigNumber, Contract, Signer, constants, utils } from 'ethers'
import { StrategyItem, TradeData, InitialState } from './encode'

import StrategyControllerLens from '../artifacts/contracts/StrategyControllerLens.sol/StrategyControllerLens.json'
import ICToken from '../artifacts/contracts/interfaces/compound/ICToken.sol/ICToken.json'
import ISynth from '../artifacts/contracts/interfaces/synthetix/ISynth.sol/ISynth.json'
import ISynthetix from '../artifacts/contracts/interfaces/synthetix/ISynthetix.sol/ISynthetix.json'
import IExchanger from '../artifacts/contracts/interfaces/synthetix/IExchanger.sol/IExchanger.json'
import ICurveRegistry from '../artifacts/contracts/interfaces/curve/ICurveRegistry.sol/ICurveRegistry.json'
import ICurveStableSwap from '../artifacts/contracts/interfaces/curve/ICurveStableSwap.sol/ICurveStableSwap.json'
import ICurveDeposit from '../artifacts/contracts/interfaces/curve/ICurveDeposit.sol/ICurveDeposit.json'
import IDMMFactory from '../artifacts/contracts/interfaces/kyber/IDMMFactory.sol/IDMMFactory.json'
import IDMMRouter02 from '../artifacts/contracts/interfaces/kyber/IDMMRouter02.sol/IDMMRouter02.json'
import IYEarnV2Vault from '../artifacts/contracts/interfaces/yearn/IYEarnV2Vault.sol/IYEarnV2Vault.json'
import UniswapV2Router from '@uniswap/v2-periphery/build/UniswapV2Router01.json'
import UniswapV3Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import ERC20 from '@uniswap/v2-periphery/build/ERC20.json'
import { DIVISOR, MAINNET_ADDRESSES } from './constants'

const { AddressZero } = constants
const { defaultAbiCoder } = utils

const SYNTHETIX = '0xE95A536cF5C7384FF1ef54819Dc54E03d0FF1979'
const SYNTHETIX_EXCHANGER = '0x3e343E89F4fF8057806F54F2208940B1Cd5C40ca'
const CURVE_REGISTRY = '0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5'
const SUSHI_ROUTER = '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'
const UNISWAP_V2_ROUTER = '0xf164fC0Ec4E93095b804a4795bBe1e041497b92a'
const UNISWAP_V3_QUOTER = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'

const STRATEGY_CONTROLLER_LENS = '' // TODO

const TRICRYPTO2 = '0xc4AD29ba4B3c580e6D59105FFf484999997675Ff'
const TRICRYPTO2_POOL = '0xD51a44d3FaE010294C616388b506AcdA1bfAAE46'
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
const WETH = MAINNET_ADDRESSES.WETH
const SUSD = MAINNET_ADDRESSES.SUSD
const VIRTUAL_ITEM = '0xffffffffffffffffffffffffffffffffffffffff'

interface ItemDictionary {
  [id: string]: StrategyItem
}

export class Estimator {
  signer: Signer

  oracle: Contract
  tokenRegistry: Contract
  curveDepositZapRegistry: Contract
  curveRegistry: Contract
  kyberFactory: Contract
  kyberRouter: Contract
  sushiRouter: Contract
  synthetix: Contract
  synthetixExchanger: Contract
  uniswapV2Router: Contract
  uniswapV3Quoter: Contract
  uniswapV3Registry: Contract

  controllerLens: Contract

  aaveV2AdapterAddress: string
  aaveV2DebtAdapterAddress: string
  balancerAdapterAddress: string
  compoundAdapterAddress: string
  curveAdapterAddress: string
  curveLPAdapterAddress: string
  curveGaugeAdapterAddress: string
  kyberSwapAdapterAddress: string
  metaStrategyAdapterAddress: string
  sushiSwapAdapterAddress: string
  synthetixAdapterAddress: string
  uniswapV2AdapterAddress: string
  uniswapV2LPAdapterAddress: string
  uniswapV3AdapterAddress: string
  yearnV2AdapterAddress: string


  public constructor(
    signer: Signer,
    oracle: Contract,
    tokenRegistry: Contract,
    uniswapV3Registry: Contract,
    curveDepositZapRegistry: Contract,
    aaveV2AdapterAddress: string,
    compoundAdapterAddress: string,
    curveAdapterAddress: string,
    curveLPAdapterAddress: string,
    curveGaugeAdapterAddress: string,
    kyberSwapAdapterAddress: string,
    metaStrategyAdapterAddress: string,
    sushiSwapAdapterAddress: string,
    synthetixAdapterAddress: string,
    uniswapV2AdapterAddress: string,
    uniswapV3AdapterAddress: string,
    yearnV2AdapterAddress: string
  ) {
    this.signer = signer

    this.curveRegistry = new Contract(CURVE_REGISTRY, ICurveRegistry.abi, signer)
    this.kyberFactory = new Contract(MAINNET_ADDRESSES.KYBER_FACTORY, IDMMFactory.abi, signer)
    this.kyberRouter = new Contract(MAINNET_ADDRESSES.KYBER_ROUTER, IDMMRouter02.abi, signer)
    this.sushiRouter = new Contract(SUSHI_ROUTER, UniswapV2Router.abi, signer)
    this.synthetix = new Contract(SYNTHETIX, ISynthetix.abi, signer)
    this.synthetixExchanger = new Contract(SYNTHETIX_EXCHANGER, IExchanger.abi, signer)
    this.uniswapV2Router = new Contract(UNISWAP_V2_ROUTER, UniswapV2Router.abi, signer)
    this.uniswapV3Quoter = new Contract(UNISWAP_V3_QUOTER, UniswapV3Quoter.abi, signer)

    this.controllerLens = new Contract(STRATEGY_CONTROLLER_LENS, StrategyControllerLens.abi, signer)

    this.oracle = oracle
    this.tokenRegistry = tokenRegistry
    this.uniswapV3Registry = uniswapV3Registry
    this.curveDepositZapRegistry = curveDepositZapRegistry

    this.aaveV2AdapterAddress = aaveV2AdapterAddress
    this.aaveV2DebtAdapterAddress = AddressZero
    this.balancerAdapterAddress = AddressZero
    this.compoundAdapterAddress = compoundAdapterAddress
    this.curveAdapterAddress = curveAdapterAddress
    this.curveLPAdapterAddress = curveLPAdapterAddress
    this.curveGaugeAdapterAddress = curveGaugeAdapterAddress
    this.kyberSwapAdapterAddress = kyberSwapAdapterAddress
    this.metaStrategyAdapterAddress = metaStrategyAdapterAddress
    this.synthetixAdapterAddress = synthetixAdapterAddress
    this.sushiSwapAdapterAddress = sushiSwapAdapterAddress
    this.uniswapV2AdapterAddress = uniswapV2AdapterAddress
    this.uniswapV2LPAdapterAddress = AddressZero
    this.uniswapV3AdapterAddress = uniswapV3AdapterAddress
    this.yearnV2AdapterAddress = yearnV2AdapterAddress
  }

  async create(
      amount: BigNumber,
      manager: string,
      name: string,
      symbol_: string,
      strategyItems: StrategyItem[],
      strategyState: InitialState,
      router: string,
      data: string
  ) {
    return await this.controllerLens.callStatic.estimateCreateStrategy(amount, manager, name, symbol_, strategyItems, strategyState, router, data)
  }

  async deposit(
      strategy: Contract,
      router: string,
      amount: BigNumber,
      slippage: 0,
      data: string
  ) {
		return this.controllerLens.callStatic.estimateDeposit(strategy.address, router, amount, slippage, data)
  }

  async withdraw(
      account: string,
      strategy: Contract,
      router: string,
      amount: BigNumber,
      slippage: BigNumber,
      data: string
  ) : Promise<string> {
    return await this.controllerLens.callStatic.estimateWithdrawWETH(account, strategy.address, router, amount, slippage, data)
  }

  async estimateBatchBuy(
      items: string[],
      synths: string[],
      itemsData: ItemDictionary,
      rebalanceThreshold: BigNumber,
      total: BigNumber,
      estimates: BigNumber[]
  ) {
      const amounts: BigNumber[] = await Promise.all(items.map(async (item: string, index: number) => {
          const { percentage, data } = itemsData[item]
          const expectedValue = percentage.eq('0') ? BigNumber.from('0') : total.mul(percentage).div(DIVISOR)
          const rebalanceRange = rebalanceThreshold.eq('0') ? BigNumber.from('0') : expectedValue.mul(rebalanceThreshold).div(DIVISOR);
          const amount = await this.estimateBuyItem(
              item,
              estimates[index],
              expectedValue,
              rebalanceRange,
              data
          );
          return this.oracle['estimateItem(uint256,address)'](amount, item)
      }))
      if (synths.length > 0) {
          // Purchase SUSD
          const percentage = itemsData[VIRTUAL_ITEM].percentage
          const data = itemsData[SUSD].data
          const expectedValue = percentage.eq('0') ?  BigNumber.from('0') : total.mul(percentage).div(DIVISOR)
          const rebalanceRange = rebalanceThreshold.eq('0') ? BigNumber.from('0') : expectedValue.mul(rebalanceThreshold).div(DIVISOR);
          const susdAmount = await this.estimateBuyItem(
              SUSD,
              estimates[estimates.length - 1],
              expectedValue,
              rebalanceRange,
              data
          );
          amounts.push(await this.estimateBuySynths(itemsData, synths, percentage, susdAmount));
      }
      const percentage = itemsData[WETH].percentage;
      if (percentage.gt('0')) {
        amounts.push(total.mul(percentage).div(DIVISOR));
      }
      return amounts.reduce((a: BigNumber, b: BigNumber) => a.add(b));
  }

  async estimateBuySynths(itemsData: ItemDictionary, synths: string[], synthPercentage: BigNumber, susdAmount: BigNumber) {
    let totalValue = BigNumber.from('0')
    let susdRemaining = susdAmount
    for (let i = 0; i < synths.length; i++) {
      const { percentage, data } = itemsData[synths[i]]
      if (!percentage.eq('0')) {
        const amount = susdAmount.mul(percentage).div(synthPercentage);
        if (amount.gt('0')) {
          const balance = await this.estimateSwap(
            data.adapters[0],
            amount,
            SUSD,
            synths[i]
          )
          const value = await this.oracle['estimateItem(uint256,address)'](balance, synths[i])
          totalValue = totalValue.add(value)
          susdRemaining = susdRemaining.sub(amount)
        }
      }
    }
    if (susdRemaining.gt('0')) {
      const value = await this.oracle['estimateItem(uint256,address)'](susdRemaining, SUSD)
      totalValue = totalValue.add(value)
    }
    return totalValue
  }

  async estimateBuyItem(
      token: string,
      estimatedValue: BigNumber,
      expectedValue: BigNumber,
      rebalanceRange: BigNumber,
      data: TradeData
  ) {
      let amount = BigNumber.from('0');
      if (estimatedValue.eq('0')) {
          amount = expectedValue;
      } else if (estimatedValue.gt(expectedValue.sub(rebalanceRange))) {
          amount = expectedValue.sub(estimatedValue);
      }
      if (amount.gt('0')) {
          if (data.cache !== '0x') {
              //Apply multiplier
              const multiplier = defaultAbiCoder.decode(['uint16'], data.cache)[0];
              amount = amount.mul(multiplier).div(DIVISOR);
          }
          return this.estimateBuyPath(
              data,
              amount,
              token
          );
      }
      return BigNumber.from('0');
  }

  async estimateBuyPath(
    data: TradeData,
    amount: BigNumber,
    token: string
  ) {
    if (amount.gt('0')) {
        let balance = amount
        for (let i = 0; i < data.adapters.length; i++) {
            const _tokenIn = (i === 0) ? WETH : data.path[i - 1]
            const _tokenOut = (i === data.adapters.length - 1) ? token : data.path[i]
            balance = await this.estimateSwap(
              data.adapters[i],
              balance,
              _tokenIn,
              _tokenOut
            )
        }
        return balance
    }
    return BigNumber.from('0')
  }

  async estimateSellPath(
    data: TradeData,
    amount: BigNumber,
    token: string
  ) {
      if (amount.gt('0')) {
          let balance = amount
          for (let i = data.adapters.length - 1; i >= 0; i--) {
              const _tokenIn = (i === data.adapters.length - 1) ? token : data.path[i]
              const _tokenOut = (i === 0) ? WETH : data.path[i - 1]
              balance = await this.estimateSwap(
                data.adapters[i],
                balance,
                _tokenIn,
                _tokenOut
              )
          }
          return balance
      }
      return BigNumber.from('0')
  }

  async estimateSellAmount(
      strategy: string,
      token: string,
      amount: BigNumber,
      estimatedValue: BigNumber
  ) {
      const balance = await (new Contract(token, ERC20.abi, this.signer)).balanceOf(strategy);
      if (estimatedValue.gt(amount)) {
        return balance.mul(amount).div(estimatedValue);
      } else {
        return balance;
      }
  }

  // TODO implement estimateSwap by using the new lens strategy with the adapters
  async estimateSwap(
    adapter: string,
    amount: BigNumber,
    tokenIn: string,
    tokenOut: string
  ) {
    switch (adapter.toLowerCase()) {
      case this.aaveV2AdapterAddress.toLowerCase(): { console.log("debug 0")
        return this.estimateAaveV2(amount, tokenIn, tokenOut)
      }
      case this.aaveV2DebtAdapterAddress.toLowerCase(): { console.log("debug 1")
        return BigNumber.from('0')//this.estimateAaveV2Debt(amount, tokenIn, tokenOut)
      }
      case this.balancerAdapterAddress.toLowerCase(): { console.log("debug 2")
        return BigNumber.from('0')//this.estimateBalancer(amount, tokenIn, tokenOut)
      }
      case this.compoundAdapterAddress.toLowerCase(): { console.log("debug 3")
        return this.estimateCompound(amount, tokenIn, tokenOut)
      }
      case this.curveAdapterAddress.toLowerCase(): { console.log("debug 4")
        return this.estimateCurve(amount, tokenIn, tokenOut)
      }
      case this.curveLPAdapterAddress.toLowerCase(): { console.log("debug 5")
        return this.estimateCurveLP(amount, tokenIn, tokenOut)
      }
      case this.curveGaugeAdapterAddress.toLowerCase(): { console.log("debug 6")
        return this.estimateCurveGauge(amount, tokenIn, tokenOut)
      }
      case this.kyberSwapAdapterAddress.toLowerCase(): { console.log("debug 7")
        return this.estimateKyberSwap(amount, tokenIn, tokenOut)
      }
      /*case this.metaStrategyAdapterAddress.toLowerCase(): { console.log("debug 8")
        return this.estimateMetaStrategy(amount, tokenIn, tokenOut) // FIXME update after `withdraw` update
      }*/
      case this.sushiSwapAdapterAddress.toLowerCase(): { console.log("debug 9")
        return this.estimateSushiSwap(amount, tokenIn, tokenOut)
      }
      case this.synthetixAdapterAddress.toLowerCase(): { console.log("debug 10")
        return this.estimateSynthetix(amount, tokenIn, tokenOut)
      }
      case this.uniswapV2AdapterAddress.toLowerCase(): { console.log("debug 11")
        return this.estimateUniswapV2(amount, tokenIn, tokenOut)
      }
      case this.uniswapV3AdapterAddress.toLowerCase(): { console.log("debug 12")
        return this.estimateUniswapV3(amount, tokenIn, tokenOut)
      }
      case this.yearnV2AdapterAddress.toLowerCase(): { console.log("debug 13")
        return this.estimateYearnV2(amount, tokenIn, tokenOut)
      }
      default: { console.log("debug 14")
        return BigNumber.from('0');
      }
    }
  }

  async estimateAaveV2(amount: BigNumber, tokenIn: string, tokenOut: string) {
      // Assumes correct tokenIn/tokenOut pairing
      if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) return BigNumber.from('0')
      return amount
  }

  async estimateCompound(amount: BigNumber, tokenIn: string, tokenOut: string) {
      const [ tokenInIsCToken, tokenOutIsCToken ] = await Promise.all([tokenIn, tokenOut].map(async (token) => {
        try {
          const isCToken = await (new Contract(token, ICToken.abi, this.signer)).isCToken()
          return isCToken
        } catch (e) {
          return false
        }
      }))
      if (tokenInIsCToken && !tokenOutIsCToken) {
        const exchangeRate = await (new Contract(tokenIn, ICToken.abi, this.signer)).callStatic.exchangeRateCurrent()
        return amount.mul(exchangeRate).div(String(10**18))
      }
      if (!tokenInIsCToken && tokenOutIsCToken) {
        const exchangeRate = await (new Contract(tokenOut, ICToken.abi, this.signer)).callStatic.exchangeRateCurrent()
        return amount.mul(String(10**18)).div(exchangeRate)
      }
      return BigNumber.from('0')
  }

  async estimateCurve(amount: BigNumber, tokenIn: string, tokenOut: string) {
      const pool = await this.curveRegistry.find_pool_for_coins(tokenIn, tokenOut, 0);
      if (pool !== AddressZero) {
          const [ indexIn, indexOut, isUnderlying ] = await this.curveRegistry.get_coin_indices(pool, tokenIn, tokenOut);
          const curveStableSwap = new Contract(pool, ICurveStableSwap.abi, this.signer)
          if (isUnderlying) {
            return curveStableSwap.get_dy_underlying(indexIn, indexOut, amount);
          } else {
            return curveStableSwap.get_dy(indexIn, indexOut, amount);
          }
      } else {
        return BigNumber.from('0')
      }
  }

  async estimateCurveLP(amount: BigNumber, tokenIn: string, tokenOut: string) {
      // Adapter's spot price is fine since there are no fees/slippage for liquidity providers
      // return (new Contract(this.curveLPAdapterAddress, IBaseAdapter.abi, this.signer)).spotPrice(amount, tokenIn, tokenOut)
      const [ poolIn, poolOut ] = await Promise.all([
        this.curveRegistry.get_pool_from_lp_token(tokenIn),
        this.curveRegistry.get_pool_from_lp_token(tokenOut)
      ])
      if (poolIn === AddressZero && poolOut !== AddressZero) {
          return this.curveDepositPrice(amount, tokenIn, poolOut, await this.curveRegistry.get_coins(poolOut));
      } else if (poolIn !== AddressZero && poolOut === AddressZero) {
          return this.curveWithdrawPrice(amount, tokenIn, tokenOut, poolIn, await this.curveRegistry.get_coins(poolIn));
      } else if (poolIn !== AddressZero && poolOut !== AddressZero) { //Metapool
          let isDeposit;
          const depositCoins = await this.curveRegistry.get_coins(poolOut);
          for (let i = 0; i < 8; i++) {
              if (depositCoins[i] === AddressZero) break;
              if (depositCoins[i].toLowerCase() === tokenIn.toLowerCase()) {
                  isDeposit = true;
                  break;
              }
          }
          if (isDeposit) {
              return this.curveDepositPrice(amount, tokenIn, poolOut, depositCoins);
          } else {
              let isWithdraw;
              const withdrawCoins = await this.curveRegistry.get_coins(poolIn);
              for (let i = 0; i < 8; i++) {
                  if (withdrawCoins[i] === AddressZero) break;
                  if (withdrawCoins[i].toLowerCase() === tokenOut.toLowerCase()) {
                      isWithdraw = true;
                      break;
                  }
              }
              if (isWithdraw) return this.curveWithdrawPrice(amount, tokenIn, tokenOut, poolIn, withdrawCoins);
          }
      } else if (tokenIn.toLowerCase() === TRICRYPTO2.toLowerCase() || tokenOut.toLowerCase() === TRICRYPTO2.toLowerCase()) {
          // tricrypto2 not in registry
          const coins = [USDT, WBTC, WETH]
          if (tokenIn.toLowerCase() === TRICRYPTO2.toLowerCase()) return this.curveWithdrawPrice(amount, tokenIn, tokenOut, TRICRYPTO2_POOL, coins);
          if (tokenOut.toLowerCase() === TRICRYPTO2.toLowerCase()) return this.curveDepositPrice(amount, tokenIn, TRICRYPTO2_POOL, coins);
      }
      return BigNumber.from(0);
  }

  async estimateCurveGauge(amount: BigNumber, tokenIn: string, tokenOut: string) {
      // Assumes correct tokenIn/tokenOut pairing
      if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) return BigNumber.from('0')
      return amount
  }

  async estimateKyberSwap(amount: BigNumber, tokenIn: string, tokenOut: string) {
    const pool = (await this.kyberFactory.getPools(tokenIn, tokenOut))[0];
    return (await this.kyberRouter.getAmountsOut(amount, [pool], [tokenIn, tokenOut]))[1]
  }

  // FIXME update to align with new `withdraw`
  /*async estimateMetaStrategy(amount: BigNumber, tokenIn: string, tokenOut: string) {
      if (tokenIn.toLowerCase() === WETH.toLowerCase()) {
        // Deposit
        const strategy = new Contract(tokenOut, IStrategy.abi, this.signer)
        return this.deposit(strategy, amount)
      } else if (tokenOut.toLowerCase() === WETH.toLowerCase()) {
        // Withdraw
        const strategy = new Contract(tokenIn, IStrategy.abi, this.signer)
        amount = amount.sub(amount.mul(2).div(DIVISOR))
        return this.withdraw(strategy, amount)
      } else {
        // Meta strategies always have weth as an input or output
        return BigNumber.from('0')
      }
  }*/

  async estimateSushiSwap(amount: BigNumber, tokenIn: string, tokenOut: string) {
    return (await this.sushiRouter.getAmountsOut(amount, [tokenIn, tokenOut]))[1]
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
    // debug
    //console.log({tokenIn, tokenOut, fee, amount});
    return this.uniswapV3Quoter.callStatic.quoteExactInputSingle(
      tokenIn,
      tokenOut,
      fee,
      amount,
      0
    )
  }

  async estimateYearnV2(amount: BigNumber, tokenIn: string, tokenOut: string) {
      // Adapter's spot price is fine since there are no fees/slippage for liquidity providers
      // return (new Contract(this.yearnV2AdapterAddress, IBaseAdapter.abi, this.signer)).spotPrice(amount, tokenIn, tokenOut)
      try {
          const vault = new Contract(tokenOut, IYEarnV2Vault.abi, this.signer)
          const token = await vault.token();
          if (token.toLowerCase() !== tokenIn.toLowerCase()) throw new Error("Not compatible");
          const [ decimals, pricePerShare ] = await Promise.all([
            vault.decimals(),
            vault.pricePerShare()
          ])
          const multiplier = BigNumber.from(10).pow(decimals)
          return amount.mul(multiplier).div(pricePerShare);
      } catch (e) {
          try {
              const vault = new Contract(tokenIn, IYEarnV2Vault.abi, this.signer)
              const token = await vault.token();
              if (token.toLowerCase() !== tokenOut.toLowerCase()) throw new Error("Not compatible");
              const [ decimals, pricePerShare ] = await Promise.all([
                vault.decimals(),
                vault.pricePerShare()
              ])
              const divisor = BigNumber.from(10).pow(decimals)
              return amount.mul(pricePerShare).div(divisor);
          } catch (e) {
              return BigNumber.from(0)
          }
      }
  }

  private async curveDepositPrice(
    amount: BigNumber,
    tokenIn: string,
    pool: string,
    coins: string[]
  ) {
    const coinsInPool = coins.filter(coin => coin !== AddressZero).length
    const tokenIndex = coins.findIndex(coin => coin.toLowerCase() === tokenIn.toLowerCase())
    if (tokenIndex === -1) return BigNumber.from(0); // Token not found

    const depositAmounts = (new Array(coinsInPool)).fill(BigNumber.from(0))
    depositAmounts[tokenIndex] = amount

    return (new Contract(
      pool,
      ICurveStableSwap.abi,
      this.signer
    ))[`calc_token_amount(uint256[${coinsInPool}],bool)`](depositAmounts, true)
  }

  private async curveWithdrawPrice(
    amount: BigNumber,
    tokenIn: string,
    tokenOut: string,
    pool: string,
    coins: string[]
  ) {
    let zap = await this.curveDepositZapRegistry.getZap(tokenIn);
    if (zap === AddressZero) zap = pool;

    const tokenIndex = coins.findIndex(coin => coin.toLowerCase() === tokenOut.toLowerCase())
    if (tokenIndex === -1) return BigNumber.from(0); // Token not found

    const indexType = await this.curveDepositZapRegistry.getIndexType(zap);
    return (new Contract(
      zap,
      ICurveDeposit.abi,
      this.signer
    ))[`calc_withdraw_one_coin(uint256,${indexType.eq(0) ? 'int128' : 'uint256'})`](
      amount,
      tokenIndex
    )
  }
}
