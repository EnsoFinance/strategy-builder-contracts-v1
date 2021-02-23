//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

interface IPortfolioManager {
    function manager() external view returns (address);
}

contract PortfolioProxyManagerRegistry {
    address private immutable proxyFactory;

    constructor(address proxyFactory_) public {
        proxyFactory = proxyFactory_;
    }

    function manager(address proxy) external view returns (address) {
        require(msg.sender == proxyFactory, "PPA.admin: Only factory");
        return IPortfolioManager(proxy).manager();
    }
}
