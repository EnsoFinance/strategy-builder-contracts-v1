#!/bin/bash

makePretty() {
    file=$(echo "$1" | sed 's/^/test\//')
    echo prettying $file
    tmpFile="tmp_prettier_""$1"

    npx prettier "$file" > "$tmpFile" 
    cp "$tmpFile" "$file"
    rm "$tmpFile"
    exit 0
}

export -f makePretty

numProcessors=$(nproc --all)
numProcessors=$(( $numProcessors - 1 ))

testFiles=$(ls test)
parallel -j $numProcessors --halt now,fail=1 makePretty ::: $testFiles 
