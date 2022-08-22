#!/bin/bash


cd contracts && grep -rn '\".*\")' | grep -E '\".{33,}\"' | grep -v macro

echo "-----------------"
echo ""
echo "note: there will be false positives"
echo ""
