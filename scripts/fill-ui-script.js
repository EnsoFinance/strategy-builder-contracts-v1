const hre = require('hardhat')
const deployedContracts = require('../deployments.json')
const { prepareStrategy } = require('../lib/encode')

const { wallets, strategyNames, positions } = require('./constants/constants')

function getRandomName() {
	return strategyNames[Math.floor(Math.random() * strategyNames.length)]
}

function getRandomArbitrary(min, max) {
	return Math.floor(Math.random() * (max - min) + min)
}

function getRandomPosition() {
	return positions[Math.floor(Math.random() * positions.length)]
}

async function main() {
	const strategyFactory = await hre.ethers.getContractAt(
		'StrategyProxyFactory',
		deployedContracts[process.env.HARDHAT_NETWORK === 'ensonet' ? 'localhost' : process.env.HARDHAT_NETWORK]
			.StrategyProxyFactory
	)

	const routerAddress = deployedContracts[process.env.HARDHAT_NETWORK].LoopRouter
	const amount = hre.ethers.BigNumber.from('100000000000000000')

	for (const pkey of wallets) {
		let wallet = new hre.ethers.Wallet(pkey, hre.ethers.provider)

		let numberOfStrategys = getRandomArbitrary(1, 4)

		for (let i = 0; i < numberOfStrategys; i++) {
			const strategyName = getRandomName()
			const position = getRandomPosition()

			const strategyItems = prepareStrategy(
				position,
				deployedContracts[process.env.HARDHAT_NETWORK].UniswapV2Adapter
			)

			const isSocial = Math.random() > 0.5 ? true : false
			let fee = isSocial ? 100 : 0

			const strategyState = {
				timelock: 60,
				rebalanceThreshold: 10,
				rebalanceSlippage: 997,
				restructureSlippage: 995,
				performanceFee: fee,
				social: isSocial,
				set: false,
			}

			let tx = await strategyFactory
				.connect(wallet)
				.createStrategy(
					wallet.address,
					strategyName,
					strategyName.substring(0, 3),
					strategyItems,
					strategyState,
					routerAddress,
					'0x',
					{ value: amount, gasLimit: 5000000 }
				)
			let receipt = await tx.wait()
			console.log('Deployment Gas Used: ', receipt.gasUsed.toString())
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
