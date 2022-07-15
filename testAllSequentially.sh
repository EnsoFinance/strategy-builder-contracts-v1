#!/bin/bash

npx hardhat compile

testFiles=$(ls test | sed 's/^/test\//')

for val in $testFiles; do
  echo "testing ""$val"
  npx hardhat test $val
  if [ $? -ne 0 ]; then
      exit 1 
  fi
done
