import { task } from "hardhat/config";
import { ADD_CONTRACTS_TO_DEFENDER_ADMIN } from "./task-names";
import dotenv from 'dotenv'
import { AdminClient } from 'defender-admin-client';
import { mainnet } from '../deployments.json'; 
import * as fs from 'fs';

task(ADD_CONTRACTS_TO_DEFENDER_ADMIN, "Add Contracts to Defender Admin", async () => {
  dotenv.config()
  let API_KEY: string | undefined = process.env.DEFENDER_API_KEY
  let API_SECRET: string | undefined = process.env.DEFENDER_API_SECRET
  if (API_KEY === undefined || API_SECRET === undefined) {
    throw Error("addContractsToDefenderAdmin: API_KEY or API_SECRET undefined.")
  }
  const client = new AdminClient({apiKey: API_KEY, apiSecret: API_SECRET});
  let contracts = [];
  let contract = {network: 'mainnet', address: '', name: '', abi: ''};
  let importPath = '';
  // most of core contracts
  for (const [key, value] of Object.entries(mainnet)) {
      contract.address = value
      contract.name = key
      importPath = 'artifacts/contracts/'+key+'.sol/'+key+'.json' 
      if (!fs.existsSync(importPath)) continue;
      importPath = '../' + importPath // fs and import resolve paths differently
      let imported = await import(importPath)
      contract.abi = JSON.stringify(imported.abi)
      contracts.push(contract);
  }
  // hacks for registries
  for (const [key, value] of Object.entries(mainnet)) {
      contract.address = value
      contract.name = key
      importPath = 'artifacts/contracts/oracles/registries/'+key+'.sol/'+key+'.json' 
      if (!fs.existsSync(importPath)) continue;
      importPath = '../' + importPath // fs and import resolve paths differently
      let imported = await import(importPath)
      contract.abi = JSON.stringify(imported.abi)
      contracts.push(contract);
  }
  // hack for oracle
  for (const [key, value] of Object.entries(mainnet)) {
      contract.address = value
      contract.name = key
      importPath = 'artifacts/contracts/oracles/'+key+'.sol/'+key+'.json' 
      if (!fs.existsSync(importPath)) continue;
      importPath = '../' + importPath // fs and import resolve paths differently
      let imported = await import(importPath)
      contract.abi = JSON.stringify(imported.abi)
      contracts.push(contract);
  }
  
  contracts.forEach((c) => {
    client.addContract(c)
  })

});
