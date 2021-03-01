const { encodeTransferFrom } = require('./encode.js')


async function prepareFlashLoan(portfolio, arbitrager, sellRouter, buyRouter, loanAmount, loanToken, pairToken) {
  const calls = []
  // Withdraw flash loan
  calls.push(await encodeTransferFrom(loanToken, portfolio.address, arbitrager.address, loanAmount))
  // Arbitrage and return flash loan
  calls.push(await encodeArbitrageLoan(arbitrager, portfolio.address, loanAmount, loanToken.address, pairToken.address, sellRouter.address, buyRouter.address))
  return calls
}

async function encodeArbitrageLoan(arbitrager, lender, amount, loanToken, pairToken, sellRouter, buyRouter) {
  const arbitrageLoanEncoded = await arbitrager.interface.encodeFunctionData("arbitrageLoan", [lender, amount, loanToken, pairToken, sellRouter, buyRouter])
  return { target: arbitrager.address, callData: arbitrageLoanEncoded, value: 0}
}

module.exports = {
  prepareFlashLoan
}
