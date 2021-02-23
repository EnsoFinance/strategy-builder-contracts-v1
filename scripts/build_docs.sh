
# make temp directory
mkdir /tmp/solidity || true

# Generic Router
yarn hardhat flatten contracts/routers/GenericRouter.sol > /tmp/solidity/GenericRouter.flat.sol
# Remove duplicate SPDX modifiers + experimental compiler statements + append 1 compiler statement
grep -v "SPDX\|experimental" /tmp/solidity/GenericRouter.flat.sol > /tmp/solidity/GenericRouter.flat.clean.sol && echo "pragma experimental ABIEncoderV2;" >> /tmp/solidity/GenericRouter.flat.clean.sol
rm /tmp/solidity/GenericRouter.flat.sol

# Portfolio Proxy Factory
yarn hardhat flatten contracts/PortfolioProxyFactory.sol > /tmp/solidity/PortfolioProxyFactory.flat.sol
grep -v "SPDX" /tmp/solidity/PortfolioProxyFactory.flat.sol > /tmp/solidity/PortfolioProxyFactory.flat.clean.sol
rm /tmp/solidity/PortfolioProxyFactory.flat.sol

# Portfolio
yarn hardhat flatten contracts/Portfolio.sol > /tmp/solidity/Portfolio.flat.sol
grep -v "SPDX" /tmp/solidity/Portfolio.flat.sol > /tmp/solidity/Portfolio.flat.clean.sol
rm /tmp/solidity/Portfolio.flat.sol

# generate docs
yarn solidity-docgen -i /tmp/solidity/ -o ./docs/markdown/ --exclude helpers,mocks

# generate uml
yarn sol2uml contracts -c -o docs/contract_diagram.png -f png

# yarn solidity-docgen -i /tmp/solidity/ -o ./docs/ 
# remove cleaned contract
rm /tmp/solidity/Portfolio.flat.clean.sol
rm /tmp/solidity/GenericRouter.flat.clean.sol
rm /tmp/solidity/PortfolioProxyFactory.flat.clean.sol

echo "Success!"