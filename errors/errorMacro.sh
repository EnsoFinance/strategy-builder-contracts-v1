#!/bin/sh

####################################
# usage:
#  // in a smart contract in ../contracts
#  require(a < b, ERROR_MACRO("This is my error message of any length, without consideration to gas cost."));
#
#  // then call this ./errorMacros.sh and it will update that file and any other file that had its
#  // error macros updated
#
####################################

input=""
inputIndex=0
errorIndexer=0

commentStart="\/\*"
commentEnd="\*\/"
jsonObject='[]'
ERROR_MACRO="ERROR_MACRO"
error_macro_for="error_macro_for"
BOOKMARK="BOOKMARK"

# assuming that the indices don't exceed 255, but is unchecked
# since there won't be that many contracts or errors within a contract

applyMacros() {

  input="$1"
  errorIndexer=0

  inputHash=$(echo "$input" | sha256sum)
  inputHash=${inputHash:0:12}

  jsonObject=$(echo $jsonObject | jq ".[$inputIndex].contractId = \"$inputHash\"" )
  jsonObject=$(echo $jsonObject | jq ".[$inputIndex].contractName = \"$input\"" )

  contractPath=$(find ../contracts -name "$input")
  hasMacros=$(cat "$contractPath"| grep "$ERROR_MACRO\|$error_macro_for")
  if [ "$hasMacros" == "" ]; then
    return 0;
  fi
  echo "  applying macros to $input"

  cp "$contractPath" tmp0.txt
  echo $BOOKMARK >> tmp0.txt
  # bookmark for strange unix bug 
  # https://stackoverflow.com/questions/12916352/shell-script-read-missing-last-line

  while IFS= read -r line;
  do
    hasBookmark=$(echo "$line" | grep $BOOKMARK)
    if [ "$hasBookmark" != "" ]; then
      line=$(echo "$line" | sed s/$BOOKMARK//)
      if [ "$line" == "" ]; then
          break;
      fi
    fi
    isErrorMacroLine=$(echo "$line" | grep "$ERROR_MACRO")
    isErrorMacroForLine=$(echo "$line" | grep "$error_macro_for")
    if [ "$isErrorMacroLine" != "" ]; then
      error="$inputHash"$(printf "%02x" "$errorIndexer")
      # chars for contract, 2 chars for errorIndexer
      errorToStore=$(echo "$line" | sed s/.*$ERROR_MACRO\(// | sed s/\).*//)

      jsonObject=$(echo $jsonObject | jq ".[$inputIndex].errorcodes.\"$error\" = $errorToStore")
      line=$(echo "$line" | sed "s/$ERROR_MACRO($errorToStore)/uint256(0x$error) $commentStart $error_macro_for($errorToStore) $commentEnd/") 
      echo "$line" >> tmp.txt
      errorIndexer=$((errorIndexer+1))
    elif [ "$isErrorMacroForLine" != "" ]; then
      error="$inputHash"$(printf "%02x" "$errorIndexer")
      # chars for contract, 2 chars for errorIndexer
      errorToStore=$(echo "$line" | sed s/.*$error_macro_for\(// | sed s/\).*//)
      jsonObject=$(echo $jsonObject | jq ".[$inputIndex].errorcodes.\"$error\" = $errorToStore")
      line=$(echo "$line" | sed "s/uint256(0x[a-z0-9]\+) $commentStart $error_macro_for($errorToStore) $commentEnd/uint256(0x$error) $commentStart $error_macro_for($errorToStore) $commentEnd/") 
      echo "$line" >> tmp.txt
      errorIndexer=$((errorIndexer+1))
    else
      echo "$line"  >> tmp.txt
    fi
  done < tmp0.txt 

  cp tmp.txt "$contractPath"
  rm tmp0.txt
  rm tmp.txt
}

# start clean
if test -f tmp.txt; then
  rm tmp.txt
fi

if test -f tmp0.txt; then
  rm tmp0.txt
fi

files=$(tree ../contracts| sed 's/.*- //' | grep sol)
for val in $files; do
  echo "checking ""$val"
  applyMacros "$val"
  inputIndex=$((inputIndex+1))
done


echo $jsonObject | jq > errors.json
