#!/bin/bash

npx hardhat compile

numProcessors=$(nproc --all)
numProcessors=$(( $numProcessors - 1 ))

testFiles=$(ls test | sed 's/^/test\//')

parallel -j $numProcessors --halt now,fail=1 npx hardhat test ::: $testFiles 

exit $?
