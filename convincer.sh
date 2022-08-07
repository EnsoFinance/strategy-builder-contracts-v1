#!/bin/bash

# FIXME need convincer-ignore

getProofFromTest() {
    echo "$1"
}

export -f getProofFromTest

getProofsFromFile() {
    filenameWithHash=$(echo "$1" | sed 's/__delimiter__/_/')
    filename=$(echo "$1" | sed 's/__delimiter__.*//')

    grep "it('\|it(\"" "test/""$filename" | sed "s/.*it('\|.*it(\"//" \
      | sed "s/', async.*\|\", async.*//" | sed "s/^/$filenameWithHash /" \
      | cat -n | sed 's/^ *//g' | sed -E 's/\t| /_/g' 
}

export -f getProofsFromFile

# by the sort step should all be unique since H(idxWithinFile, filename, testName)

lastGitCommitHash=$(cat .git/logs/HEAD | tail -1 | awk '{ print $1 }')

#expectedHash=$(ls test | sed "s/$/__delimiter__$lastGitCommitHash/" \
#  | xargs -n1 bash -c 'getProofsFromFile "$@"' {} \
#  | sort | sha256sum | awk '{ print $1 }')

#testFile=$(echo "$1" | sed 's/test\///')  

testFiles=$(ls test)

for file in $testFiles; do

    expectedHash=$(echo $file | sed "s/$/__delimiter__$lastGitCommitHash/" \
      | xargs -n1 bash -c 'getProofsFromFile "$@"' {} \
      | sort | sha256sum | awk '{ print $1 }')

    reportHash=$(cat .convincer/$file"_" | sort | sha256sum | awk '{ print $1 }')

    if [ "$reportHash" == "$expectedHash" ]; then
        echo "convincing."
    else
        # for debugging
        echo "------------------"
        echo $file | sed "s/$/__delimiter__$lastGitCommitHash/" \
          | xargs -n1 bash -c 'getProofsFromFile "$@"' {} \
          | sort

        echo "not convincing " $file"."
        echo "$reportHash" "$expectedHash"
        echo "------------------"
        #exit 1
    fi
done


#reportHash=$(cat .convincer/* | sort | sha256sum | awk '{ print $1 }')

echo $expectedHash
echo $reportHash

if [ "$reportHash" == "$expectedHash" ]; then
    echo "convincing."
    exit 0
else
    echo "not convincing."
    exit 1
fi
