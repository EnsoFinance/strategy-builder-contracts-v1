import { deployCode4renaFixes } from './code-4rena-deploy' 

async function main() {
    await deployCode4renaFixes()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
