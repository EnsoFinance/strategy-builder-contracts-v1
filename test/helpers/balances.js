const BigNumber = require('bignumber.js')
const { ethers } = require('hardhat')
const { constants } = ethers
const { AddressZero } = constants

module.exports = {
  lookupBalances: async (wrapper, tokens, weth) => {
    const total = (await wrapper.getPortfolioValue()).toString()
    console.log('Total: ', total)
    const balanceETH = BigNumber((await wrapper.getTokenValue(AddressZero)).toString())
    const percentETH = balanceETH.times(100).div(total)
    console.log('ETH Balance: ', balanceETH.toString())
    console.log('ETH Percent: ', `${percentETH.toFixed(2)}%`)
    const balanceWETH = BigNumber((await wrapper.getTokenValue(weth.address)).toString())
    const percentWETH = balanceWETH.times(100).div(total)
    console.log('WETH Balance: ', balanceWETH.toString())
    console.log('WETH Percent: ', `${percentWETH.toFixed(2)}%`)
    for (let i = 0; i < tokens.length; i++) {
      const balance = BigNumber((await wrapper.getTokenValue(tokens[i])).toString())
      const percent = balance.times(100).div(total)
      console.log(`TOK${i} Balance: `, balance.toString())
      console.log(`TOK${i} Percent: `, `${percent.toFixed(4)}%`)
    }
  }
}
