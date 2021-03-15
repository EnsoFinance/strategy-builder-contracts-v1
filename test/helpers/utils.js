const { waffle } = require('hardhat')
const provider = waffle.provider._hardhatNetwork.provider

const TIMELOCK_CATEGORY = {
	RESTRUCTURE: 0,
	THRESHOLD: 1,
	SLIPPAGE: 2,
	TIMELOCK: 3,
}

const FEE = 997
const DIVISOR = 1000

function increaseTime(seconds) {
	return provider.send('evm_increaseTime', [seconds])
}

module.exports = {
	increaseTime,
	TIMELOCK_CATEGORY,
	FEE,
	DIVISOR,
}
