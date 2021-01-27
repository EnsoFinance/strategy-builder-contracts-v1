const ERC20 = require('@uniswap/v2-core/build/ERC20.json')
const { ethers } = require('hardhat')
const { constants, getContractAt } = ethers
const { AddressZero } = constants

const DIVISOR = 1000
const FEE = 997

function preparePortfolio(positions, router){
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
    portfolioRouters.push(router)
  })
  return [portfolioTokens, portfolioPercentages, portfolioRouters]
}

async function prepareMulticall(portfolio, controller, router, oracle, wrapper, weth) {
  const calls = []
  const tokens = await portfolio.getPortfolioTokens()
  const [total, estimates] = await oracle.estimateTotal(portfolio.address, tokens)

  let wethInPortfolio = false
  // Sell loop
  for (let i = 0; i < tokens.length; i++) {
      const token = await getContractAt(ERC20.abi, tokens[i])
      const estimatedValue = ethers.BigNumber.from(estimates[i])
      const expectedValue =
          ethers.BigNumber.from(await wrapper.getExpectedTokenValue(total, token.address))
      const rebalanceRange = ethers.BigNumber.from(await wrapper.getRebalanceRange(expectedValue))
      if (estimatedValue.gt(expectedValue.add(rebalanceRange))) {
          console.log('Sell token: ', i, ' estimated value: ', estimatedValue.toString(), ' expected value: ', expectedValue.toString())
          const diff = ethers.BigNumber.from(
              await router.spotPrice(
                  estimatedValue.sub(expectedValue),
                  weth.address,
                  token.address
              )
          );
          //calls.push(await encodeTransferFrom(token, portfolio.address, controller.address, diff))
          if (token.address.toLowerCase() != weth.address.toLowerCase()) {
            //calls.push(await encodeApprove(token, router.address, diff))
            //calls.push(await encodeSwap(router, diff, 0, token.address, weth.address, controller.address, controller.address))
            calls.push(await encodeDelegateSwap(controller, portfolio.address, router.address, diff, 0, token.address, weth.address))
          } else {
            wethInPortfolio = true
          }
      }
  }
  // Buy loop
  for (let i = 0; i < tokens.length; i++) {
      const token = await getContractAt(ERC20.abi, tokens[i])
      const estimatedValue = ethers.BigNumber.from(estimates[i])
      if (token.address.toLowerCase() != weth.address.toLowerCase()) {
          if (!wethInPortfolio && i == tokens.length-1) {
              console.log('Buy token: ', i, ' estimated value: ', estimatedValue.toString())
              calls.push(await encodeSettleSwap(controller, portfolio.address, router.address, weth.address, token.address))
          } else {
              const expectedValue =
                  ethers.BigNumber.from(await wrapper.getExpectedTokenValue(total, token.address))
              const rebalanceRange = ethers.BigNumber.from(await wrapper.getRebalanceRange(expectedValue))
              if (estimatedValue.lt(expectedValue.sub(rebalanceRange))) {
                  console.log('Buy token: ', i, ' estimated value: ', estimatedValue.toString(), ' expected value: ', expectedValue.toString())
                  const diff = expectedValue.sub(estimatedValue).mul(FEE).div(DIVISOR);
                  if (token.address.toLowerCase() != weth.address.toLowerCase()) {
                    //calls.push(await encodeApprove(weth, router.address, diff))
                    //calls.push(await encodeSwap(router, diff, 0, weth.address, token.address, controller.address, portfolio.address))
                    calls.push(await encodeDelegateSwap(controller, portfolio.address, router.address, diff, 0, weth.address, token.address))
                  }
              }
          }
      }
  }
  /*
  if (wethInPortfolio) {
    calls.push(await encodeSettleTransfer(controller, weth.address, portfolio.address))
  }
  */
  return calls
}


async function encodeSwap(router, amountTokens, minTokens, tokenIn, tokenOut, accountFrom, accountTo) {
  const swapEncoded = await router.interface.encodeFunctionData("swap", [amountTokens, minTokens, tokenIn, tokenOut, accountFrom, accountTo, '0x', '0x'])
  const msgValue = tokenIn == AddressZero ? amountTokens : 0
  return { target: router.address, callData: swapEncoded, value: msgValue}
}

async function encodeDelegateSwap(controller, portfolio, router, amount, minTokens, tokenIn, tokenOut) {
  const delegateSwapEncoded = await controller.interface.encodeFunctionData("delegateSwap", [portfolio, router, amount, minTokens, tokenIn, tokenOut, '0x'])
  return { target: controller.address, callData: delegateSwapEncoded, value: 0}
}

async function encodeSettleSwap(controller, portfolio, router, tokenIn, tokenOut) {
  const settleSwapEncoded = await controller.interface.encodeFunctionData("settleSwap", [portfolio, router, tokenIn, tokenOut, '0x'])
  return { target: controller.address, callData: settleSwapEncoded, value: 0}
}
/*
async function encodeSettleTransfer(controller, token, to) {
  const settleTransferEncoded = await controller.interface.encodeFunctionData("settleTransfer", [token, to])
  return { target: controller.address, callData: settleTransferEncoded, value: 0}
}
*/

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

module.exports = {
  preparePortfolio,
  prepareMulticall,
  encodeSwap,
  encodeTransfer,
  encodeTransferFrom,
  encodeApprove
}
