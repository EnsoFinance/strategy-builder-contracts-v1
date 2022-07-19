#!/bin/bash

files=$(ls test)

for val in $files; do
  echo "prettying "$val
  npx prettier test/$val > tmp_prettier.ts 
  cp tmp_prettier.ts test/$val
done

rm tmp_prettier.ts
