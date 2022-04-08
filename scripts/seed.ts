const hre = require('hardhat')
const fs = require('fs')
const util = require('util')
const positions = require(process.env.CRAWLER_DATA_PATH + '/token_positions.json')
const tokens = require(process.env.CRAWLER_DATA_PATH + '/tokens.json')
const { prepareStrategy } = require('../lib/encode')

if (!process.env.CRAWLER_DATA_PATH) throw 'set env CRAWLER_DATA_PATH'

if (!tokens) throw 'no tokens imported from json!'
if (!positions) throw 'no positions imported from json!'

const log_file = fs.createWriteStream(__dirname + '/debug-strategies.log', { flags: 'w' })

const LEVELS = 10

const deployments = require('../deployments.json')

const network = hre.network.name

let uniswapV2Adapter = deployments[network].UniswapV2Adapter,
	uniswapV3Adapter = deployments[network].UniswapV3Adapter,
	curveAdapter = deployments[network].CurveAdapter,
	curveLPAdapter = deployments[network].CurveLPAdapter,
	yearnAdapter = deployments[network].YEarnV2Adapter,
	curveRewardsAdapter = deployments[network].CurveRewardsAdapter,
	aaveLendAdapter = deployments[network].AaveLendAdapter,
	compoundAdapter = deployments[network].CompoundAdapter,
	synthetixAdapter = deployments[network].SynthetixAdapter

const ADAPTER_MAPPER = {
	UniswapV2Adapter: uniswapV2Adapter,
	UniswapV3Adapter: uniswapV3Adapter,
	CompoundAdapter: compoundAdapter,
	AaveLendAdapter: aaveLendAdapter,
	CurveAdapter: curveAdapter,
	CurveLPAdapter: curveLPAdapter,
	CurveRewardsAdapter: curveRewardsAdapter,
	SynthetixAdapter: synthetixAdapter,
	YearnV2Adapter: yearnAdapter,
}

const filteredTokens = Object.keys(tokens)
	.filter((token) => {
		const protocol = tokens[token].protocol
		return protocol !== 1 && protocol !== 11
	})
	.filter((token) => positions[token])
console.log('Total Tokens: ', filteredTokens.length)

//const filteredTokens = ["0xD46bA6D942050d489DBd938a2C909A5d5039A161"]

const createStrategies = async (matrix: any, factory: any, signer: string) => {
	let success = 0
	for (let i = 0; i < matrix.length; i++) {
		const createStrategyArgs = matrix[i]
		if (createStrategyArgs) {
			try {
				let tx = await factory.connect(signer).createStrategy(...createStrategyArgs)
				let receipt = await tx.wait()
				success++
				console.log('Deployment Gas Used: ', receipt.gasUsed.toString())
			} catch (e) {
				const errMessage = `Failed to create a strategy at index: ${i}. \n ${e.message} \n ${JSON.stringify(
					createStrategyArgs,
					null,
					2
				)}`
				log_file.write(util.format(errMessage) + '\n')
				console.log(errMessage)
			}
		}
	}
	console.log(`Successfully deployed ${((success * 100) / matrix.length).toFixed(2)}% of strategies.`)
}

const main = async () => {
	const [signer] = await hre.ethers.getSigners()

	if (deployments && deployments[network]) {
		// @ts-ignore
		const deployedAddresses = deployments[network]

		if (!deployedAddresses.LoopRouter) throw Error('LoopRouter not deployed')
		if (!deployedAddresses.StrategyProxyFactory) throw Error('Factory not deployed')

		const strategyFactory = await hre.ethers.getContractAt(
			'StrategyProxyFactory',
			deployedAddresses.StrategyProxyFactory
		)

		const routerAddress = deployedAddresses.LoopRouter

		const amount = hre.ethers.BigNumber.from('1000000000000000')
		const createStrategyArgsMatrix = filteredTokens.map((token, i) => {
			const strategyName = i + ': ' + token + ' (' + Math.random() + ')' // Random number in name in case of repeat calls

			let position = positions[token]
			position.adapters = position.adapters.map((adapterName: string) => (ADAPTER_MAPPER as any)[adapterName])
			if (position.path.length >= LEVELS) {
				// For troubleshooting to determine where along the path a trade fails
				console.log('Adjust path')
				const itemsToDelete = position.adapters.length - LEVELS
				console.log('Items to delete: ', itemsToDelete)
				const newToken = position.path[LEVELS - 1]
				position.adapters.splice(position.adapters.length - itemsToDelete, itemsToDelete)
				position.path.splice(position.path.length - itemsToDelete, itemsToDelete)
				console.log('New adapters: ', position.adapters)
				console.log('New path: ', position.path)
				position.token = newToken
			}
			position.percentage = 1000
			const strategyItems = prepareStrategy([position], uniswapV3Adapter)
			const isSocial = Math.random() > 0.05
			let fee = isSocial ? 100 : 0
			const strategyState = {
				timelock: 60,
				rebalanceThreshold: 10,
				rebalanceSlippage: 995,
				restructureSlippage: 1,
				performanceFee: fee,
				social: isSocial,
				set: false,
			}
			return [
				signer.address,
				strategyName,
				strategyName.substring(0, 3),
				strategyItems,
				strategyState,
				routerAddress,
				'0x',
				{ value: amount, gasLimit: 5000000 },
			]
		})
		await createStrategies(createStrategyArgsMatrix, strategyFactory, signer)
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
