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

async function main() {
	// Hardhat always runs the compile task when running scripts with its command
	// line interface.
	//
	// If this script is run directly using `node` you may want to call compile
	// manually to make sure everything is compiled
	// await hre.run('compile');
	const [signer] = await hre.ethers.getSigners()
  const multisig = '0xca702d224D61ae6980c8c7d4D98042E22b40FFdB'
	const owner = network == 'mainnet' ? multisig : signer.address //smart contract upgrades multisig
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
	if (tokenRegistryOwner.toLowerCase() !== factoryAddress.toLowerCase()) {
      if (tokenRegistryOwner.toLowerCase() !== signer.address.toLowerCase()) {
          throw Error("Signer doesn't own tokenRegistry.")
      }
      const tx = await tokenRegistry.connect(signer).transferOwnership(factoryAddress)
      const receipt = await tx.wait()
      console.log('tokenRegistry.transferOwnership tx.receipt.transactionHash', receipt.transactionHash)
  }

	const ChainlinkRegistry = await hre.ethers.getContractFactory('ChainlinkRegistry')
	let chainlinkRegistry: Contract
	if (!contracts['ChainlinkRegistry']) {
		  throw Error('ChainlinkRegistry must be deployed.')
	} else {
		  chainlinkRegistry = ChainlinkRegistry.attach(contracts['ChainlinkRegistry'])
	}
	const chainlinkRegistryOwner = await chainlinkRegistry.owner()
	if (chainlinkRegistryOwner.toLowerCase() !== multisig.toLowerCase()) {
      if (chainlinkRegistryOwner.toLowerCase() !== signer.address.toLowerCase()) {
          throw Error("Signer doesn't own chainlinkRegistry.")
      }
      const tx = await chainlinkRegistry.connect(signer).transferOwnership(multisig)
      const receipt = await tx.wait()
      console.log('chainlinkRegistry.transferOwnership tx.receipt.transactionHash', receipt.transactionHash)
  }

	const UniswapV3Registry = await hre.ethers.getContractFactory('UniswapV3Registry')
	let uniswapV3Registry: Contract
	if (!contracts['UniswapV3Registry']) {
		  throw Error('UniswapV3Registry must be deployed.')
	} else {
		  uniswapV3Registry = UniswapV3Registry.attach(contracts['UniswapV3Registry'])
	}
	const uniswapV3RegistryOwner = await uniswapV3Registry.owner()
	if (uniswapV3RegistryOwner.toLowerCase() !== multisig.toLowerCase())  {
      if (uniswapV3RegistryOwner.toLowerCase() !== signer.address.toLowerCase()) {
          throw Error("Signer doesn't own uniswapV3Registry.")
      }
      const tx = await uniswapV3Registry.connect(signer).transferOwnership(multisig)
      const receipt = await tx.wait()
      console.log('chainlinkRegistry.transferOwnership tx.receipt.transactionHash', receipt.transactionHash)
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
