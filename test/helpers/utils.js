const { waffle } = require('hardhat')
const provider = waffle.provider._hardhatNetwork.provider

const TIMELOCK_CATEGORY = {
  RESTRUCTURE: 0,
  THRESHOLD: 1,
  SLIPPAGE: 2,
  TIMELOCK: 3
}

function increaseTime(seconds) {
  return provider.send("evm_increaseTime", [seconds])
}

module.exports = {
  increaseTime,
  TIMELOCK_CATEGORY
}
