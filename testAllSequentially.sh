#!/bin/bash

npx hardhat compile

ls test | sed 's/^/test\//' | xargs -n 1 sh -c 'npx hardhat test $0 || exit 255'

# -n 1 "execute one-by-one"
# exit 255 if command fails -> causes xargs to exit

exit $?
