const hre = require('hardhat')
const deployedContracts = require('../deployments.json')
const { prepareStrategy } = require('../lib/encode')
const dictionary = require('../dictionary.json')

const fs = require('fs')
const util = require('util')
const log_file = fs.createWriteStream(__dirname + '/debug-strategies.log', { flags: 'w' })


const createStrategies = async (matrix, strategyFactory, wallet) => {
	let i = 0,
		success = 0,
		failed = 0
	for (const createStrategyArgs of matrix) {
		try {
			let tx = await strategyFactory.connect(wallet).createStrategy(...createStrategyArgs)
			let receipt = await tx.wait()
			success++
			console.log('Deployment Gas Used: ', receipt.gasUsed.toString())
		} catch (e) {
			const errMessage = `${e.message} \n Failed to create a strategy at index: ${i}. \n ${
				e.message
			} \n ${JSON.stringify(createStrategyArgs, null, 2)}`
			log_file.write(util.format(errMessage) + '\n')
			failed++
			console.log(errMessage)
		}
		i++
	}
	console.log(`Successfully deployed ${((success * 100) / matrix.length).toFixed(2)}% of strategies.`)
}

const main = async () => {
	const uniswapAdapter = deployedContracts[process.env.HARDHAT_NETWORK].UniswapV2Adapter
	const curveLPAdapter = deployedContracts[process.env.HARDHAT_NETWORK].CurveLPAdapter
	const yearnAdapter = deployedContracts[process.env.HARDHAT_NETWORK].YEarnV2Adapter
	const curveRewardsAdapter = deployedContracts[process.env.HARDHAT_NETWORK].CurveRewardsAdapter
	const aaveLendAdapter = deployedContracts[process.env.HARDHAT_NETWORK].AaveLendAdapter
	const compoundAdapter = deployedContracts[process.env.HARDHAT_NETWORK].CompoundAdapter

	const DICTIONARY_ADAPTER_MAPPER = {
		'0x11b6dd97b8d2dEC7aF4E544e966c80f3B6D50E0c': uniswapAdapter,
		'0xeABF5ff735Eb522e2765f41cf213D9550093a3a3': curveLPAdapter,
		'0x69e98aA7e9EcAb7dF7d54cFf8cCAa48b2E72a5a4': yearnAdapter,
		'0xD73E8c234AAC92657d94FD1541106c2f4cb14654': curveRewardsAdapter,
		'0xec49b0Fe6941b1a3c90F75e6A43d812Cd6aDa2ff': aaveLendAdapter,
		'0x250ea055E49F890cb269e729Cf81A04D7Ccd5f3E': compoundAdapter
	}

	const strategyFactory = await hre.ethers.getContractAt(
		'StrategyProxyFactory',
		deployedContracts[process.env.HARDHAT_NETWORK === 'ensonet' ? 'localhost' : process.env.HARDHAT_NETWORK]
			.StrategyProxyFactory
	)
	console.log(process.env.HARDHAT_NETWORK)
	const wallet = new hre.ethers.Wallet(
		'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
		hre.ethers.provider
	)
	const routerAddress = deployedContracts[process.env.HARDHAT_NETWORK].LoopRouter
	const amount = hre.ethers.BigNumber.from('1000000000000000')
	const dictionaryEntries = Object.entries(dictionary).map(([_, value]) => value)
	const derivedTokens = dictionaryEntries.reduce((m, { derivedAssets }) => [...m, ...derivedAssets], [])
	const createStrategyArgsMatrix = derivedTokens.map((derivedToken, i) => {
		const strategyName = i + '/' + derivedToken.symbol
		const position = derivedToken.position
		position.percentage = 1000
		position.adapters = position.adapters.map(adapter => DICTIONARY_ADAPTER_MAPPER[adapter])
		const strategyItems = prepareStrategy([position], uniswapAdapter)
		const isSocial = Math.random() > 0.05
		let fee = isSocial ? 100 : 0
		const strategyState = {
			timelock: 60,
			slippage: 0,
			rebalanceThreshold: 10,
			rebalanceSlippage: 997,
			restructureSlippage: 995,
			performanceFee: fee,
			social: isSocial,
			set: false,
		}
		return [
			wallet.address,
			strategyName,
			strategyName.substring(0, 3),
			strategyItems,
			strategyState,
			routerAddress,
			'0x',
			{ value: amount, gasLimit: 5000000 },
		]
	})

	await createStrategies(createStrategyArgsMatrix, strategyFactory, wallet)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
