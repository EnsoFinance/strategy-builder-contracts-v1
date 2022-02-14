#!/bin/bash
# shellcheck disable=SC2164
cd /home/ubuntu/v1-core/contracts
yarn
yarn build
pm2 kill
pm2 start yarn --name "enso-network" -- start
sleep 5  #Wait for network to spin up
yarn deploy localhost
yarn register-tokens localhost
yarn register-dictionary localhost
yarn hardhat addOwnerFunds --network localhost
pm2 start ethernal --name "ethernal" -- listen
