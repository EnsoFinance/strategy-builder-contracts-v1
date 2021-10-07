#!/bin/bash
# shellcheck disable=SC2164
cd /home/ubuntu/Monorepo/contracts
yarn
pm2 kill
pm2 start yarn --name "enso-network" -- start
sleep 20  #Wait for network to spin up
yarn deploy localhost
