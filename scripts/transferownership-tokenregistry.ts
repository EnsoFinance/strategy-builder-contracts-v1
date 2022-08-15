// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import hre from 'hardhat'
import { Contract } from 'ethers'
import deploymentsJSON from '../deployments.json'

const deployments: { [key: string]: { [key: string]: string } } = deploymentsJSON

let contracts: { [key: string]: string } = {}
let network: string
if (process.env.HARDHAT_NETWORK) {
	network = process.env.HARDHAT_NETWORK
	//ts-ignore
	if (deployments[network]) contracts = deployments[network]
}

// To be run after tokens are registered

export async function transferOwnershipTokenRegistry() {
	// Hardhat always runs the compile task when running scripts with its command
	// line interface.
	//
	// If this script is run directly using `node` you may want to call compile
	// manually to make sure everything is compiled
	// await hre.run('compile');
	const [signer] = await hre.ethers.getSigners()
	const owner = network == 'mainnet' ? '0xca702d224D61ae6980c8c7d4D98042E22b40FFdB' : signer.address //smart contract upgrades multisig
	console.log('Owner: ', owner)

	const TokenRegistry = await hre.ethers.getContractFactory('TokenRegistry')
	let tokenRegistry: Contract
	if (!contracts['TokenRegistry']) {
		throw Error('TokenRegistry must be deployed.')
	} else {
		tokenRegistry = TokenRegistry.attach(contracts['TokenRegistry'])
	}
	const tokenRegistryOwner = await tokenRegistry.owner()
	const factoryAddress = contracts['StrategyProxyFactory']
	if (tokenRegistryOwner.toLowerCase() !== signer.address.toLowerCase()) {
		throw Error("Signer doesn't own tokenRegistry.")
	}
	const tx = await tokenRegistry.connect(signer).transferOwnership(factoryAddress)
	const receipt = await tx.wait()
	console.log('tokenRegistry.transferOwnership tx.receipt.transactionHash', receipt.transactionHash)
}
