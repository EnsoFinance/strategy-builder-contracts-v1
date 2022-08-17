#!/bin/bash

# npx hardhat run scripts/run-code-4rena-deploy.ts && \
## TODO then manually change deployments.json
  npx hardhat run scripts/register/register_tokens.ts && \
  npx hardhat run scripts/register/register_uniswap_pools.ts && \
  npx hardhat run scripts/register/register_curve_pools.ts && \
  npx hardhat run scripts/register/register_chainlink_oracles.ts && \
  npx hardhat run scripts/transferownership-afterdeploy.ts 
