
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
        require(msg.sender == proxyFactory, "PortfolioProxyAdmin.admin: Only factory may call admin");
        return IPortfolioManager(proxy).manager();
    }
}
