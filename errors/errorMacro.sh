#!/bin/sh

input=StrategyController.sol
inputIndex=0
#functionIndexer=0
errorIndexer=0
commentStart="\/*"
commentEnd="*\/"

# assuming that the indices don't exceed 255, but is unchecked
# since there won't be that many functions or errors within a function

jsonObject='[{"contract": "'$input'", "errorcodes": {}}]'

jsonObject=$(echo $jsonObject | jq ".[0].contractId = $inputIndex")

while IFS= read -r line
do
  isFunctionOrModifier=$(echo "$line" | grep "function\|modifier\|receive\|fallback")
  if [ "$isFunctionOrModifier" != "" ]; then
    functionName=\"$(echo $line | sed 's/function //' | sed 's/modifier //' | sed 's/receive //' | sed 's/fallback //' | sed 's/(.*//')\"
  fi 
  isErrorMacroLine=$(echo "$line" | grep "ERROR_MACRO")
  if [ "$isErrorMacroLine" != "" ]; then
    error=$(printf "%02x" "$inputIndex")$(printf "%02x" "$errorIndexer")
    # 2 chars for contract, 2 chars for errorIndexer
    errorToStore=$(echo "$line" | sed s/.*ERROR_MACRO\(// | sed s/\).*//)

    jsonObject=$(echo $jsonObject | jq ".[0].errorcodes.\"$error\" = $errorToStore")
    line=$(echo "$line" | sed "s/ERROR_MACRO($errorToStore)/uint256(0x$error) $commentStart error_macro($errorToStore) $commentEnd/") 
    echo "$line"
    errorIndexer=$((errorIndexer+1))
  else
    echo "$line" 
  fi
done < ../contracts/"$input"

echo $jsonObject | jq > errors.json

## TODO recalibrate macros
