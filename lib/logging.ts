import { Contract } from '@ethersproject/contracts'
const BigNumber = require('bignumber.js')
const { ethers } = require('hardhat')
const { constants } = ethers
const { AddressZero } = constants

export async function displayBalances(wrapper: Contract, tokens: string[], weth: Contract) {
	const total = (await wrapper.getStrategyValue()).toString()
	console.log('Total: ', total)
	const balanceETH = BigNumber((await wrapper.getTokenValue(AddressZero)).toString())
	const percentETH = balanceETH.times(100).div(total)
	console.log('\nETH Balance: ', balanceETH.toString())
	console.log('ETH Percent: ', `${percentETH.toFixed(2)}%`)
	const balanceWETH = BigNumber((await wrapper.getTokenValue(weth.address)).toString())
	const percentWETH = balanceWETH.times(100).div(total)
	console.log('\nWETH Balance: ', balanceWETH.toString())
	console.log('WETH Percent: ', `${percentWETH.toFixed(4)}%`)
	for (let i = 0; i < tokens.length; i++) {
		const balance = BigNumber((await wrapper.getTokenValue(tokens[i])).toString())
		const percent = balance.times(100).div(total)
		console.log(`\nTOK${i}: `, tokens[i])
		console.log(`TOK${i} Balance: `, balance.toString())
		console.log(`TOK${i} Percent: `, `${percent.toFixed(4)}%`)
	}
}
export function colorLog(message: string, defaultColor: string) {
	let color = defaultColor || 'black'

	switch (color) {
		case 'success':
			color = 'Green'
			break
		case 'info':
			color = 'DodgerBlue'
			break
		case 'error':
			color = 'Red'
			break
		case 'warning':
			color = 'Orange'
			break
		default:
			color = defaultColor
	}

	console.log('%c' + message, 'color:' + color)
}
