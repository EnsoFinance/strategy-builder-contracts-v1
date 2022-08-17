#!/bin/bash

git checkout deployments.json

rm -r data && cp -r /home/george/synced/synced/enso/crawler-token-farms/data .

npx hardhat run scripts/run-code-4rena-deploy.ts 

_localhost=$(cat deployments.json | jq '.localhost')
_mainnet=$(cat deployments.json | jq '.mainnet')
cat deployments.json | jq ".mainnet=$_localhost" | jq "._mainnet=$_mainnet" | tee deployments.json
  npx hardhat run scripts/register/register_tokens.ts && \
  npx hardhat run scripts/register/register_uniswap_pools.ts && \
  npx hardhat run scripts/register/register_curve_pools.ts && \
  npx hardhat run scripts/register/register_chainlink_oracles.ts && \
  npx hardhat run scripts/transferownership-afterdeploy.ts 
