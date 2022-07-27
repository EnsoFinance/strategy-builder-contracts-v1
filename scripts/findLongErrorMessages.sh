#!/bin/bash

cd contracts && grep -rn '\".*\")' | grep -E '\".{33,}\"' | grep -v macro
