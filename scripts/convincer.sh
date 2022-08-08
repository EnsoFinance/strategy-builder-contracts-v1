#!/bin/bash

getProofsFromFile() {
    filenameWithHash=$(echo "$1" | sed 's/__delimiter__/_/')
    filename=$(echo "$1" | sed 's/__delimiter__.*//')

    grep "it('\|it(\"" "test/""$filename" | grep -v "convincer-ignore" | sed "s/.*it('\|.*it(\"//" \
      | sed "s/', async.*\|\", async.*//" | sed "s/^/$filenameWithHash /" \
      | cat -n | sed 's/^ *//g' | sed -E 's/\t| /_/g' 
}

export -f getProofsFromFile

# by the sort step should all be unique since H(idxWithinFile, filename, testName)


main() {

    lastGitCommitHash=$(git log -2 --format=format:"%H"| tail -1)
    git log -2 --format=format:"%H" # debugging
    echo $lastGitCommitHash
    #cat .convincer/testreport.txt | head -1)

    expectedHash=$(ls test | sed "s/$/__delimiter__$lastGitCommitHash/" \
      | xargs -n1 bash -c 'getProofsFromFile "$@"' {} \
      | sort | sha256sum | awk '{ print $1 }')

    reportHash=$(cat .convincer/testreport.txt | tail -1)

    if [ "$reportHash" == "$expectedHash" ]; then
        echo "convincing."
        exit 0
    else
        echo "not convincing."
        exit 1
    fi
}

debug() {
    lastGitCommitHash=$(git rev-parse HEAD)
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

localRun() {
    lastGitCommitHash=$(git rev-parse HEAD)
    expectedHash=$(ls test | sed "s/$/__delimiter__$lastGitCommitHash/" \
      | xargs -n1 bash -c 'getProofsFromFile "$@"' {} \
      | sort | sha256sum | awk '{ print $1 }')

    touch .convincer/testreport.txt
    testReport=$(cat .convincer/testreport.txt)
    rm .convincer/testreport.txt
    reportHash=$(cat .convincer/* | sort | sha256sum | awk '{ print $1 }')
    echo "$testReport" > .convincer/testreport.txt

    if [ "$reportHash" == "$expectedHash" ]; then
        echo "convincing."
        exit 0
    else
        echo "not convincing."
        exit 1
    fi
}

help() {
    echo "help:"
    echo "  The workflow is after a passing commit, run ./convincer.sh -local"
    echo "  if 'convincing' then add commit, and push .convincer/testreport.txt."
    echo "  The ci then will run ./convincer.sh without a flag"
    echo ""
    echo "  to run in debugging mode or localRun"
    echo "  ./convincer.sh -debug"
    echo ""
    echo "troubleshooting:"
    echo "  be sure 2nd to last git commit matches those in .convincer/*"
    echo "  if not, rerun all tests using either 'npx hardhat test',"
    echo "  or ./scripts/testAllConcurrently."
    echo ""
    echo "  be sure to commit and push .convincer/testreport.txt"
    echo ""
    echo "  commented out tests must have 'convincer-ignore' as comment in same"
    echo "  line as it('Should..',... clause."
    exit 0
}

while getopts ":hdl::" arg; do
  case "$arg" in
      d)
        debug
        ;;
      l)
        localRun 
        ;;
      h | *)
        help
        ;;
    esac
done

main
