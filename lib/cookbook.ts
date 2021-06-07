import { encodeTransferFrom } from './encode'
import { BigNumber, Contract } from 'ethers'

export async function prepareFlashLoan(
	strategy: Contract,
	arbitrager: Contract,
	sellAdapter: Contract,
	buyAdapter: Contract,
	loanAmount: BigNumber,
	loanToken: Contract,
	pairToken: Contract
) {
	const calls = []
	// Withdraw flash loan
	calls.push(encodeTransferFrom(loanToken, strategy.address, arbitrager.address, loanAmount))
	// Arbitrage and return flash loan
	calls.push(
		encodeArbitrageLoan(
			arbitrager,
			strategy.address,
			loanAmount,
			loanToken.address,
			pairToken.address,
			sellAdapter.address,
			buyAdapter.address
		)
	)
	return calls
}

export function encodeArbitrageLoan(
	arbitrager: Contract,
	lender: string,
	amount: BigNumber,
	loanToken: string,
	pairToken: string,
	sellAdapter: string,
	buyAdapter: string
) {
	const arbitrageLoanEncoded = arbitrager.interface.encodeFunctionData('arbitrageLoan', [
		lender,
		amount,
		loanToken,
		pairToken,
		sellAdapter,
		buyAdapter,
	])
	return { target: arbitrager.address, callData: arbitrageLoanEncoded, value: 0 }
}
