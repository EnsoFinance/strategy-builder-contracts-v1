# make temp directory
mkdir /tmp/solidity || true

# Generic Controller
npx hardhat flatten contracts/controllers/GenericController.sol > /tmp/solidity/GenericController.flat.sol
# Remove duplicate SPDX modifiers + experimental compiler statements + append 1 compiler statement
grep -v "SPDX\|experimental" /tmp/solidity/GenericController.flat.sol > /tmp/solidity/GenericController.flat.clean.sol && echo "pragma experimental ABIEncoderV2;" >> /tmp/solidity/GenericController.flat.clean.sol
rm /tmp/solidity/GenericController.flat.sol

# Portfolio Proxy Factory
npx hardhat flatten contracts/PortfolioProxyFactory.sol > /tmp/solidity/PortfolioProxyFactory.flat.sol
grep -v "SPDX" /tmp/solidity/PortfolioProxyFactory.flat.sol > /tmp/solidity/PortfolioProxyFactory.flat.clean.sol
rm /tmp/solidity/PortfolioProxyFactory.flat.sol

# Portfolio
npx hardhat flatten contracts/Portfolio.sol > /tmp/solidity/Portfolio.flat.sol
grep -v "SPDX" /tmp/solidity/Portfolio.flat.sol > /tmp/solidity/Portfolio.flat.clean.sol
rm /tmp/solidity/Portfolio.flat.sol

# generate docs
npx solidity-docgen -i /tmp/solidity/ -o ./docs/markdown/ --exclude helpers,mocks

# generate uml
npx sol2uml contracts -c -o docs/contract_diagram.png -f png

# npx solidity-docgen -i /tmp/solidity/ -o ./docs/ 
# remove cleaned contract
rm /tmp/solidity/Portfolio.flat.clean.sol
rm /tmp/solidity/GenericController.flat.clean.sol
rm /tmp/solidity/PortfolioProxyFactory.flat.clean.sol

echo "Success!"