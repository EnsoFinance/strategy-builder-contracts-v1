require("@nomiclabs/hardhat-waffle");
require("solidity-coverage");
const dotenv = require("dotenv")
dotenv.config()

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

module.exports = {
  networks: {
    hardhat: {
    },
    mainnet: {
      url: process.env.MAINNET_URL,
      accounts: [process.env.MAINNET_PRIVATE_KEY]
    },
    kovan: {
      url: process.env.KOVAN_URL,
      accounts: [process.env.KOVAN_PRIVATE_KEY]
    },
    rinkeby: {
      url: process.env.RINKEBY_URL,
      accounts: [process.env.RINKEBY_PRIVATE_KEY]
    }
  },
  solidity: "0.6.12",
  settings: {
    optimizer: {
      enabled: true,
      runs: 20
    }
  }
};
