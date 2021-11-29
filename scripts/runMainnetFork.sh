#!/bin/bash
# shellcheck disable=SC2164
cd /home/ubuntu/Monorepo/contracts
yarn
pm2 kill
pm2 start yarn --name "enso-network" -- start
sleep 5  #Wait for network to spin up
yarn deploy localhost
yarn register-tokens localhost
yarn register-dictionary localhost
pm2 start ethernal --name "ethernal" -- listen
