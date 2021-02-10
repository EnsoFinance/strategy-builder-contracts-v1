//SPDX-License-Identifier: Unlicense
pragma solidity 0.6.12;

interface IPortfolioOwner {
    function owner() external view returns (address);
}

contract PortfolioProxyAdminRegistry {
    address private immutable proxyFactory;

    constructor(address proxyFactory_) public {
        proxyFactory = proxyFactory_;
    }

    function admin(address proxy) external view returns (address) {
        require(msg.sender == proxyFactory, "PortfolioProxyAdmin.admin: Only factory may call admin");
        return IPortfolioOwner(proxy).owner();
    }
}
