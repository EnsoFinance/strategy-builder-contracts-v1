const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
const UniswapV2Pair = require('@uniswap/v2-core/build/UniswapV2Pair.json')
const { ethers } = require('hardhat')
const { constants, getContractAt, getContractFactory } = ethers
const { AddressZero } = constants
const { FEE, DIVISOR } = require('./utils.js')

function preparePortfolio(positions, adapter){
  let portfolioTokens = []
  let portfolioPercentages = []
  let portfolioRouters = []
  positions.sort((a, b) => {
    const aNum = ethers.BigNumber.from(a.token)
    const bNum = ethers.BigNumber.from(b.token)
    return aNum.sub(bNum)
  }).forEach(position => {
    portfolioTokens.push(position.token)
    portfolioPercentages.push(position.percentage)
    portfolioRouters.push(adapter)
  })
  return [portfolioTokens, portfolioPercentages, portfolioRouters]
}

async function prepareUniswapSwap(router, adapter, factory, from, to, amount, tokenIn, tokenOut) {
  const calls = []
  //Get pair address
  const pairAddress = await factory.getPair(tokenIn.address, tokenOut.address)
  if (pairAddress !== AddressZero) {
    const pair = await getContractAt(UniswapV2Pair.abi, pairAddress)
    //Transfer input token to pair address
    if (from.toLowerCase() === router.address.toLowerCase()) {
      calls.push(await encodeTransfer(tokenIn, pairAddress, amount))
    } else {
      calls.push(await encodeTransferFrom(tokenIn, from, pairAddress, amount))
    }
    //Swap tokens
    const received = await adapter.swapPrice(amount, tokenIn.address, tokenOut.address)
    const tokenInNum = ethers.BigNumber.from(tokenIn.address)
    const tokenOutNum = ethers.BigNumber.from(tokenOut.address)
    if (tokenInNum.lt(tokenOutNum)) {
      calls.push(await encodeUniswapPairSwap(pair, 0, received, to))
    } else if (tokenOutNum.lt(tokenInNum)) {
      calls.push(await encodeUniswapPairSwap(pair, received, 0, to))
    } else {
      return []
    }
    return calls
  }
}

async function prepareRebalanceMulticall(portfolio, controller, router, adapter, oracle, factory, weth) {
  const calls = []
  const buyLoop = []
  const tokens = await portfolio.tokens()
  const [total, estimates] = await oracle.estimateTotal(portfolio.address, tokens)

  let wethInPortfolio = false
  // Sell loop
  for (let i = 0; i < tokens.length; i++) {
      const token = await getContractAt(ERC20.abi, tokens[i])
      const estimatedValue = ethers.BigNumber.from(estimates[i])
      const expectedValue =
          ethers.BigNumber.from(await getExpectedTokenValue(total, token.address, portfolio))
      const rebalanceRange = ethers.BigNumber.from(await getRebalanceRange(expectedValue, controller, portfolio))
      if (estimatedValue.gt(expectedValue.add(rebalanceRange))) {
          //console.log('Sell token: ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString(), ' expected value: ', expectedValue.toString())
          if (token.address.toLowerCase() != weth.address.toLowerCase()) {
            const diff = ethers.BigNumber.from(
                await adapter.spotPrice(
                    estimatedValue.sub(expectedValue),
                    weth.address,
                    token.address
                )
            );
            //calls.push(await encodeDelegateSwap(router, portfolio.address, adapter.address, diff, 0, token.address, weth.address))
            const swapCalls = await prepareUniswapSwap(router, adapter, factory, portfolio.address, router.address, diff, token, weth)
            calls.push(...swapCalls)
          } else {
            const diff = estimatedValue.sub(expectedValue)
            calls.push(await encodeTransferFrom(token, portfolio.address, controller.address, diff))
            wethInPortfolio = true
          }
      } else {
        buyLoop.push({
          token: tokens[i],
          estimate: estimates[i]
        })
      }
  }
  // Buy loop
  for (let i = 0; i < buyLoop.length; i++) {
      const token = await getContractAt(ERC20.abi, buyLoop[i].token)
      const estimatedValue = ethers.BigNumber.from(buyLoop[i].estimate)
      if (token.address.toLowerCase() != weth.address.toLowerCase()) {
          if (!wethInPortfolio && i == buyLoop.length-1) {
              //console.log('Buy token:  ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString())
              // The last token must use up the remainder of funds, but since balance is unknown, we call this function which does the final cleanup
              calls.push(await encodeSettleSwap(router, adapter.address, weth.address, token.address, router.address, portfolio.address))
          } else {
              const expectedValue =
                  ethers.BigNumber.from(await getExpectedTokenValue(total, token.address, portfolio))
              const rebalanceRange = ethers.BigNumber.from(await getRebalanceRange(expectedValue, controller, portfolio))
              if (estimatedValue.lt(expectedValue.sub(rebalanceRange))) {
                  //console.log('Buy token:  ', ('00' + i).slice(-2), ' estimated value: ', estimatedValue.toString(), ' expected value: ', expectedValue.toString())
                  const diff = expectedValue.sub(estimatedValue).mul(FEE).div(DIVISOR);
                  const swapCalls = await prepareUniswapSwap(router, adapter, factory, router.address, portfolio.address, diff, weth, token)
                  calls.push(...swapCalls)
              }
          }
      }
  }
  if (wethInPortfolio) {
    calls.push(await encodeSettleTransfer(controller, weth.address, portfolio.address))
  }
  return calls
}

async function prepareDepositMulticall(portfolio, controller, router, adapter, factory, weth, total, tokens, percentages) {
  const calls = []
  //calls.push(await encodeWethDeposit(weth, total))
  calls.push(await encodeTransferFrom(weth, controller.address, router.address, total))
  let wethInPortfolio = false
  for (let i = 0; i < tokens.length; i++) {
      const token = await getContractAt(ERC20.abi, tokens[i])

      if (token.address.toLowerCase() !== weth.address.toLowerCase()) {
        if (!wethInPortfolio && i == tokens.length-1) {
          calls.push(await encodeSettleSwap(router, adapter.address, weth.address, token.address, router.address, portfolio.address))
        } else {
          const expectedValue =
              ethers.BigNumber.from(total).mul(percentages[i]).div(DIVISOR)
          //console.log('Buy token: ', i, ' estimated value: ', 0, ' expected value: ', expectedValue.toString())
          const swapCalls = await prepareUniswapSwap(router, adapter, factory, router.address, portfolio.address, expectedValue, weth, token)
          calls.push(...swapCalls)
        }
      } else {
        wethInPortfolio = true
      }
  }
  if (wethInPortfolio) {
    calls.push(await encodeSettleTransfer(router, weth.address, portfolio.address))
  }
  return calls
}

async function preparePermit(portfolio, owner, spender, value, deadline) {
  const [name, chainId, nonce] = await Promise.all([
    portfolio.name(),
    portfolio.chainId(),
    portfolio.nonces(owner.address)
  ])
  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "uint256" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ]
    },
    primaryType: 'Permit',
    domain: {
      name: name,
      version: 1,
      chainId: chainId.toString(),
      verifyingContract: portfolio.address
    },
    message: {
      owner: owner.address,
      spender: spender.address,
      value: value,
      nonce: nonce.toString(),
      deadline: deadline
    }
  }
  return ethers.utils.splitSignature(await owner.provider.send('eth_signTypedData', [
    owner.address,
    typedData
  ]))
}

async function calculateAddress(portfolioFactory, creator, name, symbol, tokens, percentages) {
  const [salt, implementation, version, controller] = await Promise.all([
    portfolioFactory.salt(creator, name, symbol),
    portfolioFactory.implementation(),
    portfolioFactory.version(),
    portfolioFactory.controller()
  ])

  const Proxy = await getContractFactory('TransparentUpgradeableProxy')
  const Portfolio = await getContractFactory('Portfolio')

  const deployTx = Proxy.getDeployTransaction(
    implementation,
    portfolioFactory.address,
    Portfolio.interface.encodeFunctionData("initialize", [name, symbol, version, controller, creator, tokens, percentages])
  )
  return ethers.utils.getCreate2Address(portfolioFactory.address, salt, ethers.utils.keccak256(deployTx.data))
}

async function getExpectedTokenValue(total, token, portfolio) {
  const percentage = await portfolio.tokenPercentage(token)
  return ethers.BigNumber.from(total).mul(percentage).div(DIVISOR);
}

async function getRebalanceRange(expectedValue, controller, portfolio) {
  const threshold = await controller.rebalanceThreshold(portfolio.address)
  return ethers.BigNumber.from(expectedValue).mul(threshold).div(DIVISOR);
}

async function encodeSwap(adapter, amountTokens, minTokens, tokenIn, tokenOut, accountFrom, accountTo) {
  const swapEncoded = await adapter.interface.encodeFunctionData("swap", [amountTokens, minTokens, tokenIn, tokenOut, accountFrom, accountTo, '0x', '0x'])
  const msgValue = tokenIn == AddressZero ? amountTokens : 0
  return { target: adapter.address, callData: swapEncoded, value: msgValue}
}

async function encodeDelegateSwap(router, portfolio, adapter, amount, minTokens, tokenIn, tokenOut) {
  const delegateSwapEncoded = await router.interface.encodeFunctionData("delegateSwap", [portfolio, adapter, amount, minTokens, tokenIn, tokenOut, '0x'])
  return { target: router.address, callData: delegateSwapEncoded, value: 0}
}

async function encodeUniswapPairSwap(pair, amount0Out, amount1Out, accountTo) {
  const pairSwapEncoded = await pair.interface.encodeFunctionData("swap", [amount0Out, amount1Out, accountTo, '0x'])
  return { target: pair.address, callData: pairSwapEncoded, value: 0}
}

async function encodeSettleSwap(router, adapter, tokenIn, tokenOut, accountFrom, accountTo) {
  const settleSwapEncoded = await router.interface.encodeFunctionData("settleSwap", [adapter, tokenIn, tokenOut, accountFrom, accountTo, '0x'])
  return { target: router.address, callData: settleSwapEncoded, value: 0}
}

async function encodeSettleTransfer(router, token, to) {
  const settleTransferEncoded = await router.interface.encodeFunctionData("settleTransfer", [token, to])
  return { target: router.address, callData: settleTransferEncoded, value: 0}
}

async function encodeTransfer(token, to, amount) {
  const transferEncoded = await token.interface.encodeFunctionData("transfer", [to, amount])
  return { target: token.address, callData: transferEncoded, value: 0 }
}

async function encodeTransferFrom(token, from, to, amount) {
  const transferFromEncoded = await token.interface.encodeFunctionData("transferFrom", [from, to, amount])
  return { target: token.address, callData: transferFromEncoded, value: 0 }
}

async function encodeApprove(token, to, amount) {
  const approveEncoded = await token.interface.encodeFunctionData("approve", [to, amount])
  return { target: token.address, callData: approveEncoded, value: 0 }
}

async function encodeWethDeposit(weth, amount) {
  const depositEncoded = await weth.interface.encodeFunctionData("deposit", [])
  return { target: weth.address, callData: depositEncoded, value: amount }
}

module.exports = {
  preparePortfolio,
  prepareRebalanceMulticall,
  prepareDepositMulticall,
  preparePermit,
  prepareUniswapSwap,
  calculateAddress,
  encodeSwap,
  encodeDelegateSwap,
  encodeTransfer,
  encodeTransferFrom,
  encodeApprove,
  encodeWethDeposit,
  encodeSettleSwap,
  encodeSettleTransfer,
  getExpectedTokenValue,
  getRebalanceRange
}
