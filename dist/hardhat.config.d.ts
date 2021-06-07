/**
 * @type import('hardhat/config').HardhatUserConfig
 */
import { HardhatUserConfig } from 'hardhat/types';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import 'solidity-coverage';
import '@typechain/hardhat';
import './tasks/accounts';
import './tasks/clean';
declare let config: HardhatUserConfig;
export default config;
