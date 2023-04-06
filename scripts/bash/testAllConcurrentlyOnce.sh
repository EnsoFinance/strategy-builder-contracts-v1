#!/bin/bash

# gpl v3 copyright George R Carder

npx hardhat compile > tmp_sol_compile_logs.txt
exitCode=$?
if [ $exitCode -ne 0 ]; then
    rm tmp_sol_compile_logs.txt
    exit $exitCode
fi

wasCompiled=$(cat tmp_sol_compile_logs.txt | grep Compiled)
rm tmp_sol_compile_logs.txt
notTestedFilename=".notTested.txt"
touch $notTestedFilename
testFiles=$(ls test | sed 's/^/test\//')

# bootstrapped when fresh compile
if [ ! -z "$wasCompiled" ]; then # means was compiled so we need to run all tests
    rm $notTestedFilename
    touch $notTestedFilename
else
    testFiles=$(cat .notTested.txt)
fi

writeTestLog() {
    touch .convincer/testreport.txt
    rm .convincer/testreport.txt
    reportHash=$(cat .convincer/* | sort | sha256sum | awk '{ print $1 }')
    git rev-parse HEAD > .convincer/testreport.txt
    echo $reportHash >> .convincer/testreport.txt
}

if [ -z "$testFiles" ]; then
    echo "no files to test"
    writeTestLog
    exit 0
fi

testThenTouchFile() {
    npx hardhat test $1
    exitCode=$?
    if [ $exitCode -ne 0 ]; then
        exit $exitCode
    fi
    touch $1
    exit 0
}

startSeconds=$(date +%s)

export -f testThenTouchFile

numProcessors=$(nproc --all)
numProcessors=$(( $numProcessors - 1 ))

parallel -j $numProcessors --halt now,fail=1 testThenTouchFile ::: $testFiles 

exitCode=$?

# loop over test files, if touched is before timeNow put in .notTested.txt
rm $notTestedFilename
touch $notTestedFilename
for file in $testFiles; do
    lastTouched=$(date +%s -r $file)
    timeLapsed=$(( $lastTouched - $startSeconds ))
    if [ $timeLapsed -lt 0 ]; then
       echo $file >> $notTestedFilename
    fi
done

if [ $exitCode == 0 ]; then 
    writeTestLog
fi

exit $exitCode
