#!/bin/bash


getProofFromTest() {
    echo "$1"
}

export -f getProofFromTest

getProofsFromFile() {
    filenameWithHash=$(echo "$1" | sed 's/__delimiter__/_/')
    filename=$(echo "$1" | sed 's/__delimiter__.*//')

    grep "it('" "test/""$filename" | sed "s/it('//" | sed "s/'.*//" | sed "s/^/$filenameWithHash/" | cat -n | sed 's/^ *//g' | sed -E 's/\t| /_/g' | sed -E 's/^|$/\"/g' | xargs -n1 bash -c 'getProofFromTest "$@"' {}

}

export -f getProofsFromFile

# by the sort step should all be unique since H(idxWithinFile, filename, testName)

lastGitCommitHash=$(cat .git/logs/HEAD | tail -1 | awk '{ print $1 }')

expectedHash=$(ls test | sed "s/$/__delimiter__$lastGitCommitHash/" | xargs -n1 bash -c 'getProofsFromFile "$@"' {} | sort | sha256sum | awk '{ print $1 }')
#ls test | sed "s/$/__delimiter__$lastGitCommitHash/" | xargs -n1 bash -c 'getProofsFromFile "$@"' {} | sort #| sha256sum | awk '{ print $1 }'


proof=$(cat .convincer/* | sort | sha256sum | awk '{ print $1 }')

if [ "$proof" == "$expectedHash" ]; then
    echo "proof correct."
    exit 0
else
    echo "proof incorrect."
    exit 1
fi
