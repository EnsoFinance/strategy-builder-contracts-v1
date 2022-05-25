#!/bin/sh

# TODO make general
input=StrategyController.sol
inputIndex=0
errorIndexer=0

commentStart="\/\*"
commentEnd="\*\/"

# assuming that the indices don't exceed 255, but is unchecked
# since there won't be that many contracts or errors within a contract

jsonObject='[{"contract": "'$input'", "errorcodes": {}}]'
jsonObject=$(echo $jsonObject | jq ".[0].contractId = $inputIndex")

ERROR_MACRO="ERROR_MACRO"
error_macro_for="error_macro_for"

while IFS= read -r line
do
  isErrorMacroLine=$(echo "$line" | grep "$ERROR_MACRO")
  isErrorMacroForLine=$(echo "$line" | grep "$error_macro_for")
  if [ "$isErrorMacroLine" != "" ]; then
    error=$(printf "%02x" "$inputIndex")$(printf "%02x" "$errorIndexer")
    # 2 chars for contract, 2 chars for errorIndexer
    errorToStore=$(echo "$line" | sed s/.*$ERROR_MACRO\(// | sed s/\).*//)

    jsonObject=$(echo $jsonObject | jq ".[0].errorcodes.\"$error\" = $errorToStore")
    line=$(echo "$line" | sed "s/$ERROR_MACRO($errorToStore)/uint256(0x$error) $commentStart $error_macro_for($errorToStore) $commentEnd/") 
    echo "$line"
    errorIndexer=$((errorIndexer+1))
  elif [ "$isErrorMacroForLine" != "" ]; then
    error=$(printf "%02x" "$inputIndex")$(printf "%02x" "$errorIndexer")
    # 2 chars for contract, 2 chars for errorIndexer
    errorToStore=$(echo "$line" | sed s/.*$error_macro_for\(// | sed s/\).*//)
    jsonObject=$(echo $jsonObject | jq ".[0].errorcodes.\"$error\" = $errorToStore")
    line=$(echo "$line" | sed "s/uint256(0x[0-9]\+) $commentStart $error_macro_for($errorToStore) $commentEnd/uint256(0x$error) $commentStart $error_macro_for($errorToStore) $commentEnd/") 
    echo "$line"
    errorIndexer=$((errorIndexer+1))
  else
    echo "$line" 
  fi
done < ../contracts/"$input"

echo $jsonObject | jq > errors.json
