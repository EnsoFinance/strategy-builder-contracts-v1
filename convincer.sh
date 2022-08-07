#!/bin/bash

getProofFromTest() {
    echo "$1"
}

export -f getProofFromTest

getProofsFromFile() {
    filenameWithHash=$(echo "$1" | sed 's/__delimiter__/_/')
    filename=$(echo "$1" | sed 's/__delimiter__.*//')

    grep "it('\|it(\"" "test/""$filename" | grep -v "convincer-ignore" | sed "s/.*it('\|.*it(\"//" \
      | sed "s/', async.*\|\", async.*//" | sed "s/^/$filenameWithHash /" \
      | cat -n | sed 's/^ *//g' | sed -E 's/\t| /_/g' 
}

export -f getProofsFromFile

# by the sort step should all be unique since H(idxWithinFile, filename, testName)

lastGitCommitHash=$(cat .git/logs/HEAD | tail -1 | awk '{ print $1 }')

main() {

    expectedHash=$(ls test | sed "s/$/__delimiter__$lastGitCommitHash/" \
      | xargs -n1 bash -c 'getProofsFromFile "$@"' {} \
      | sort | sha256sum | awk '{ print $1 }')

    touch .convincer/testreport.txt
    rm .convincer/testreport.txt
    reportHash=$(cat .convincer/* | sort | sha256sum | awk '{ print $1 }')
    echo "$reportHash" > .convincer/testreport.txt

    if [ "$reportHash" == "$expectedHash" ]; then
        echo "convincing."
        exit 0
    else
        echo "not convincing."
        exit 1
    fi
}

debug() {
    testFile=$(echo "$1" | sed 's/test\///')  
    testFiles=$(ls test)
    for file in $testFiles; do

        expectedHash=$(echo $file | sed "s/$/__delimiter__$lastGitCommitHash/" \
          | xargs -n1 bash -c 'getProofsFromFile "$@"' {} \
          | sort | sha256sum | awk '{ print $1 }')

        reportHash=$(cat .convincer/$file"_" | sort | sha256sum | awk '{ print $1 }')

        if [ "$reportHash" == "$expectedHash" ]; then
            echo "convincing."
        else
            echo "------------------"
            echo $file | sed "s/$/__delimiter__$lastGitCommitHash/" \
              | xargs -n1 bash -c 'getProofsFromFile "$@"' {} \
              | sort

            echo "not convincing " $file"."
            echo "$reportHash" "$expectedHash"
            echo "------------------"
            exit 1
        fi
    done
    exit 0
}

help() {
    echo "help:"
    echo "  to run in debugging mode"
    echo "  ./convincer.sh -debug"
    echo ""
    echo "troubleshooting:"
    echo "  be sure 2nd to last git commit matches those in .convincer/*"
    echo "  if not, rerun all tests using either 'npx hardhat test',"
    echo "  or ./scripts/testAllConcurrently."
    echo ""
    echo "  be sure to commit and push .convincer/testreport.txt"
    exit 0
}

while getopts ":hd:m:" arg; do
  case "$arg" in
      d)
        debug
        ;;
      h | *)
        help
        ;;
    esac
done

main
