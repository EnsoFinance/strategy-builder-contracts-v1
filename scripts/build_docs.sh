
# make temp directory
mkdir /tmp/solidity || true

# Generic Router
yarn hardhat flatten contracts/routers/GenericRouter.sol > /tmp/solidity/GenericRouter.flat.sol
# Remove duplicate SPDX modifiers + experimental compiler statements + append 1 compiler statement
grep -v "SPDX\|experimental" /tmp/solidity/GenericRouter.flat.sol > /tmp/solidity/GenericRouter.flat.clean.sol && echo "pragma experimental ABIEncoderV2;" >> /tmp/solidity/GenericRouter.flat.clean.sol
rm /tmp/solidity/GenericRouter.flat.sol

# Strategy Proxy Factory
yarn hardhat flatten contracts/StrategyProxyFactory.sol > /tmp/solidity/StrategyProxyFactory.flat.sol
grep -v "SPDX" /tmp/solidity/StrategyProxyFactory.flat.sol > /tmp/solidity/StrategyProxyFactory.flat.clean.sol
rm /tmp/solidity/StrategyProxyFactory.flat.sol

# Strategy
yarn hardhat flatten contracts/Strategy.sol > /tmp/solidity/Strategy.flat.sol
grep -v "SPDX" /tmp/solidity/Strategy.flat.sol > /tmp/solidity/Strategy.flat.clean.sol
rm /tmp/solidity/Strategy.flat.sol

# generate docs
yarn solidity-docgen -i /tmp/solidity/ -o ./docs/markdown/ --exclude helpers,mocks

# generate uml
yarn sol2uml contracts -c -o docs/contract_diagram.png -f png

# yarn solidity-docgen -i /tmp/solidity/ -o ./docs/ 
# remove cleaned contract
rm /tmp/solidity/Strategy.flat.clean.sol
rm /tmp/solidity/GenericRouter.flat.clean.sol
rm /tmp/solidity/StrategyProxyFactory.flat.clean.sol

echo "Success!"